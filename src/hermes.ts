import type { NormalizedJob } from "./greenhouse.ts";
import type { CapabilityProfile, OpportunityMatch } from "./matcher.ts";
import { matchOpportunity } from "./matcher.ts";
import type { OutreachDraft } from "./gemini.ts";
import type { ApprovalMessageInput, ApprovalDecision, SlackPostResult } from "./slack.ts";
import type { EmailInput, EmailResult } from "./gmail.ts";
import type { SheetRow, SheetsAppendResult } from "./sheets.ts";
import { createActionId } from "./storage.ts";

export interface FlowRecord {
  actionId: string;
  job: NormalizedJob;
  match: OpportunityMatch;
  outreach: OutreachDraft;
  slack: SlackPostResult;
  decision: "pending" | "approve" | "reject";
  emailStatus: "pending" | "not_attempted" | "dry_run" | "draft" | "sent" | "failed";
  sheetStatus: "pending" | "not_attempted" | "mock" | "recorded" | "failed";
  status: "awaiting_approval" | "rejected" | "completed" | "failed" | "partial_failure";
  error?: string;
  emailExternalId?: string;
  timestamp: string;
}

export interface FlowDependencies {
  fetchJobs: () => Promise<NormalizedJob[]>;
  generateOutreach: (
    job: NormalizedJob,
    profile: CapabilityProfile,
    match: OpportunityMatch,
  ) => Promise<OutreachDraft>;
  postApproval: (input: ApprovalMessageInput) => Promise<SlackPostResult>;
  sendApprovedEmail: (input: EmailInput) => Promise<EmailResult>;
  appendSheetRow: (row: SheetRow) => Promise<SheetsAppendResult>;
  saveResult: (result: FlowRecord) => Promise<void>;
  getResult?: (actionId: string) => Promise<FlowRecord | undefined>;
}

export interface RunFlowOptions {
  profile: CapabilityProfile;
  dependencies: FlowDependencies;
  now?: Date;
  decision?: ApprovalDecision;
  recipientEmail?: string;
}

export class FlowError extends Error {
  public readonly stage: string;

  constructor(stage: string, message: string) {
    super(stage + ": " + message);
    this.stage = stage;
    this.name = "FlowError";
  }
}

function decisionFromEnvironment(): ApprovalDecision | undefined {
  if (process.env.JUDGE_MODE?.toLowerCase() === "true") return undefined;
  const value = process.env.SLACK_APPROVAL || process.env.APPROVAL;
  if (value === "approve" || value === "approved") return "approve";
  if (value === "reject" || value === "rejected") return "reject";
  return undefined;
}

function sheetRow(record: FlowRecord): SheetRow {
  return {
    timestamp: record.timestamp,
    company: record.job.company,
    role: record.job.role,
    sourceUrl: record.job.sourceUrl,
    matchScore: record.match.score,
    decision: record.decision,
    emailStatus: record.emailStatus,
  };
}

async function saveSheetFailure(
  record: FlowRecord,
  dependencies: FlowDependencies,
  error: unknown,
): Promise<never> {
  record.sheetStatus = "failed";
  record.status = record.emailStatus === "sent" || record.emailStatus === "draft" || record.emailStatus === "dry_run"
    ? "partial_failure"
    : "failed";
  record.error = error instanceof Error ? error.message : String(error);
  await dependencies.saveResult(record);
  throw new FlowError("google_sheets", record.error);
}

function latestJob(jobs: NormalizedJob[]): NormalizedJob {
  return jobs.slice().sort((a, b) => {
    const aTime = Date.parse(a.postedAt || "");
    const bTime = Date.parse(b.postedAt || "");
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  })[0];
}

export async function runFlow(options: RunFlowOptions): Promise<FlowRecord> {
  let jobs: NormalizedJob[];
  try {
    jobs = await options.dependencies.fetchJobs();
  } catch (error) {
    throw new FlowError("greenhouse", error instanceof Error ? error.message : String(error));
  }
  if (jobs.length === 0) {
    throw new FlowError("greenhouse", "no jobs were returned");
  }

  const job = latestJob(jobs);
  const match = matchOpportunity(job, options.profile, options.now);
  let outreach: OutreachDraft;
  try {
    outreach = await options.dependencies.generateOutreach(job, options.profile, match);
  } catch (error) {
    throw new FlowError("gemini", error instanceof Error ? error.message : String(error));
  }

  const actionId = createActionId(job.company, job.role, outreach.subject, outreach.body);
  const previous = options.dependencies.getResult
    ? await options.dependencies.getResult(actionId)
    : undefined;
  if (previous && previous.status !== "awaiting_approval") {
    return previous;
  }

  const slackInput: ApprovalMessageInput = { actionId, job, match, outreach };
  let slack: SlackPostResult;
  try {
    slack = await options.dependencies.postApproval(slackInput);
  } catch (error) {
    throw new FlowError("slack", error instanceof Error ? error.message : String(error));
  }

  const decision = options.decision || decisionFromEnvironment();
  const timestamp = new Date().toISOString();
  const record: FlowRecord = {
    actionId,
    job,
    match,
    outreach,
    slack,
    decision: decision || "pending",
    emailStatus: "pending",
    sheetStatus: "pending",
    status: decision ? (decision === "reject" ? "rejected" : "completed") : "awaiting_approval",
    timestamp,
  };

  if (!decision) {
    await options.dependencies.saveResult(record);
    return record;
  }

  if (decision === "reject") {
    record.emailStatus = "not_attempted";
    await options.dependencies.saveResult(record);
    try {
      const sheet = await options.dependencies.appendSheetRow(sheetRow(record));
      record.sheetStatus = sheet.status;
      await options.dependencies.saveResult(record);
      return record;
    } catch (error) {
      return saveSheetFailure(record, options.dependencies, error);
    }
  }

  record.decision = "approve";
  record.status = "completed";
  await options.dependencies.saveResult(record);

  let email: EmailResult;
  try {
    email = await options.dependencies.sendApprovedEmail({
      actionId,
      to: options.recipientEmail || process.env.GMAIL_TO || "dry-run@example.invalid",
      subject: outreach.subject,
      body: outreach.body,
    });
  } catch (error) {
    record.emailStatus = "failed";
    record.status = "failed";
    record.error = error instanceof Error ? error.message : String(error);
    await options.dependencies.saveResult(record);
    try {
      const sheet = await options.dependencies.appendSheetRow(sheetRow(record));
      record.sheetStatus = sheet.status;
      await options.dependencies.saveResult(record);
    } catch (sheetError) {
      record.sheetStatus = "failed";
      record.error += "; " + (sheetError instanceof Error ? sheetError.message : String(sheetError));
      await options.dependencies.saveResult(record);
    }
    throw new FlowError("gmail", record.error);
  }

  record.emailStatus = email.status;
  record.emailExternalId = email.externalId;
  await options.dependencies.saveResult(record);

  try {
    const sheet = await options.dependencies.appendSheetRow(sheetRow(record));
    record.sheetStatus = sheet.status;
    record.status = "completed";
    await options.dependencies.saveResult(record);
    return record;
  } catch (error) {
    return saveSheetFailure(record, options.dependencies, error);
  }
}
