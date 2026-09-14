import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Agent, tool } from "@strands-agents/sdk";
import { GoogleModel } from "@strands-agents/sdk/models/google";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { fetchGreenhouseJobs } from "./greenhouse.ts";
import type { NormalizedJob } from "./greenhouse.ts";
import { generateOutreach } from "./gemini.ts";
import { createGmailClient } from "./gmail.ts";
import { matchOpportunity } from "./matcher.ts";
import type { CapabilityProfile } from "./matcher.ts";
import { createSheetsClient } from "./sheets.ts";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const model = new GoogleModel({
  client,
  modelId: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  params: {
    temperature: 0.2,
    maxOutputTokens: 3000,
  },
});

const SYSTEM_PROMPT = `You are Odyva GTM, a human-governed GTM agent.

Your job is to use the provided tools to:

1. retrieve live hiring intent
2. match opportunities against verified resume evidence
3. rank opportunities
4. prepare grounded outreach

Never invent resume claims.
Never fabricate jobs.
Never claim a tool succeeded unless the tool returned success.

You may research, rank and prepare autonomously.

External reputation-bearing actions require human approval.

Never send email without an explicit approved action.

For a complete workflow invocation, you MUST call prepare_outreach for the selected winning opportunity before returning your final response. Do not write the outreach yourself. An invocation explicitly labeled "Stage A analysis-only" may return ranked opportunities for the follow-up Stage B invocation.`;

export interface StrandsMatchResult {
  company: string;
  role: string;
  score: number;
  capability_fit: number;
  hiring_intent: number;
  resume_evidence: string[];
  urgency: number;
  reasons: string[];
  gap: string;
  source_url: string;
  job_id: string;
}

export interface StrandsRunState {
  jobs: NormalizedJob[];
  matches: StrandsMatchResult[];
  outreach?: { subject: string; body: string };
}

const runState: StrandsRunState = {
  jobs: [],
  matches: [],
};

let lastGreenhouseJobs: NormalizedJob[] = [];

export function resetStrandsRunState(): void {
  runState.jobs = [];
  runState.matches = [];
  delete runState.outreach;
  lastGreenhouseJobs = [];
}

export function getStrandsRunState(): StrandsRunState {
  return {
    jobs: [...runState.jobs],
    matches: [...runState.matches],
    outreach: runState.outreach ? { ...runState.outreach } : undefined,
  };
}

async function loadCapabilityProfile(): Promise<CapabilityProfile> {
  const raw = await readFile("data/capability_profile.json", "utf8");
  if (raw.trim().length === 0) {
    throw new Error("Capability profile is empty");
  }
  return JSON.parse(raw) as CapabilityProfile;
}

function simplifiedJob(job: NormalizedJob): Record<string, unknown> {
  const description = job.description.length > 1000
    ? job.description.slice(0, 1000) + "..."
    : job.description;
  return {
    company: job.company,
    role: job.role,
    job_id: job.id,
    source_url: job.sourceUrl,
    location: null,
    description,
    ...(job.postedAt ? { posted_at: job.postedAt } : {}),
  };
}

function parseJobsJson(value: string): NormalizedJob[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Strands matcher: jobs_json was not valid JSON");
  }
  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { jobs?: unknown }).jobs)
      ? (parsed as { jobs: unknown[] }).jobs
      : [];
  if (records.length === 0) {
    throw new Error("Strands matcher: jobs_json contained no jobs");
  }

  return records.map((record, index) => {
    if (!record || typeof record !== "object") {
      throw new Error("Strands matcher: job " + index + " was not an object");
    }
    const item = record as Record<string, unknown>;
    const id = typeof item.job_id === "string"
      ? item.job_id
      : typeof item.id === "string"
        ? item.id
        : String(item.job_id ?? item.id ?? "");
    const company = typeof item.company === "string" ? item.company : "";
    const role = typeof item.role === "string" ? item.role : "";
    const sourceUrl = typeof item.source_url === "string"
      ? item.source_url
      : typeof item.sourceUrl === "string"
        ? item.sourceUrl
        : "";
    if (!id || !company || !role || !sourceUrl) {
      throw new Error("Strands matcher: job " + index + " is missing required fields");
    }
    return {
      id,
      company,
      role,
      sourceUrl,
      description: typeof item.description === "string" ? item.description : "",
      postedAt: typeof item.posted_at === "string"
        ? item.posted_at
        : typeof item.postedAt === "string"
          ? item.postedAt
          : undefined,
    };
  });
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function sentenceLimit(body: string, maximum: number): string {
  const sentences = body.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.slice(0, maximum).join(" ").trim();
}

function stableActionId(input: { to: string; subject: string; body: string }): string {
  return "strands-draft-" + createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 24);
}

export const greenhouseSearchTool = tool({
  name: "greenhouse_search",
  description: "Fetch live Greenhouse hiring opportunities. This tool never uses fixtures.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(5),
  }),
  callback: async ({ limit }) => {
    console.log("STRANDS_TOOL_GREENHOUSE_USED");
    if (process.env.GREENHOUSE_FIXTURE_PATH) {
      throw new Error("Strands Greenhouse tool: fixture data is disabled");
    }
    const jobs = await fetchGreenhouseJobs(process.env.GREENHOUSE_BOARD_TOKEN || "", {
      company: process.env.GREENHOUSE_COMPANY,
    });
    lastGreenhouseJobs = jobs.slice(0, limit);
    runState.jobs = [...lastGreenhouseJobs];
    return JSON.stringify(lastGreenhouseJobs.map(simplifiedJob));
  },
});

export const matchResumeTool = tool({
  name: "match_resume",
  description: "Apply the existing deterministic capability matcher to live Greenhouse jobs.",
  inputSchema: z.object({
    resume_text: z.string().min(1),
    jobs_json: z.string().min(2),
  }),
  callback: async ({ resume_text, jobs_json }) => {
    console.log("STRANDS_TOOL_MATCHER_USED");
    if (resume_text.trim().length === 0) {
      throw new Error("Strands matcher: resume_text is required");
    }
    const jobs = parseJobsJson(jobs_json);
    if (lastGreenhouseJobs.length > 0) {
      const liveJobs = new Map(lastGreenhouseJobs.map((job) => [job.id, job]));
      for (const job of jobs) {
        const liveJob = liveJobs.get(job.id);
        if (!liveJob || liveJob.sourceUrl !== job.sourceUrl) {
          throw new Error("Strands matcher: jobs_json did not match the live Greenhouse result");
        }
      }
    }
    const profile = await loadCapabilityProfile();
    const matches = jobs
      .map((job) => {
        const match = matchOpportunity(job, profile);
        const gap = match.matchedCapabilities.length === 0
          ? "No direct verified capability overlap found by the deterministic matcher."
          : "No verified capability gap was recorded by the deterministic matcher.";
        return {
          company: job.company,
          role: job.role,
          score: match.score,
          capability_fit: match.capabilityFit,
          hiring_intent: match.intent,
          resume_evidence: [...match.matchedCapabilities],
          urgency: match.urgency,
          reasons: [...match.reasons],
          gap,
          source_url: job.sourceUrl,
          job_id: job.id,
        } satisfies StrandsMatchResult;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    runState.matches = [...matches];
    return JSON.stringify(matches);
  },
});

export interface PrepareOutreachInput {
  company: string;
  role: string;
  job_context: string;
  resume_context: string;
}

export async function prepareStrandsOutreach({
  company,
  role,
  job_context,
  resume_context,
}: PrepareOutreachInput): Promise<string> {
  console.log("STRANDS_TOOL_PREPARE_OUTREACH_USED");
  const jobRecord = parseJsonObject(job_context);
  if (resume_context.trim().length === 0) {
    throw new Error("Strands outreach: resume_context is required");
  }
  const requestedJobId = typeof jobRecord.job_id === "string"
    ? jobRecord.job_id
    : typeof jobRecord.id === "string"
      ? jobRecord.id
      : undefined;
  const verifiedJob = requestedJobId
    ? lastGreenhouseJobs.find((job) => job.id === requestedJobId)
    : undefined;
  if (lastGreenhouseJobs.length > 0 && !verifiedJob) {
    throw new Error("Strands outreach: job_context did not identify a live Greenhouse job");
  }
  const job: NormalizedJob = {
    id: verifiedJob?.id || requestedJobId || "strands-job",
    company: verifiedJob?.company || company,
    role: verifiedJob?.role || role,
    sourceUrl: verifiedJob?.sourceUrl || (typeof jobRecord.source_url === "string"
      ? jobRecord.source_url
      : typeof jobRecord.sourceUrl === "string"
        ? jobRecord.sourceUrl
        : ""),
    description: verifiedJob?.description || (typeof jobRecord.description === "string" ? jobRecord.description : job_context),
    postedAt: verifiedJob?.postedAt || (typeof jobRecord.posted_at === "string"
      ? jobRecord.posted_at
      : typeof jobRecord.postedAt === "string"
        ? jobRecord.postedAt
        : undefined),
  };
  const profile = await loadCapabilityProfile();
  const match = matchOpportunity(job, profile);
  const outreach = await generateOutreach(job, profile, match, {
    mode: "live",
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  });
  const result = {
    subject: outreach.subject,
    body: sentenceLimit(outreach.body, 4),
  };
  runState.outreach = result;
  return JSON.stringify(result);
}

export const prepareOutreachTool = tool({
  name: "prepare_outreach",
  description: "Generate grounded outreach through the existing direct Gemini adapter.",
  inputSchema: z.object({
    company: z.string().min(1),
    role: z.string().min(1),
    job_context: z.string().min(2),
    resume_context: z.string().min(1),
  }),
  callback: prepareStrandsOutreach,
});

const gmailDraftClient = createGmailClient({
  mode: "draft",
  accessToken: process.env.GMAIL_ACCESS_TOKEN,
  clientId: process.env.GMAIL_CLIENT_ID,
  clientSecret: process.env.GMAIL_CLIENT_SECRET,
  refreshToken: process.env.GMAIL_REFRESH_TOKEN,
});

export const createGmailDraftTool = tool({
  name: "create_gmail_draft",
  description: "Create a real Gmail draft. This tool never sends email.",
  inputSchema: z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
  callback: async ({ to, subject, body }) => {
    const result = await gmailDraftClient.createDraft({
      actionId: stableActionId({ to, subject, body }),
      to,
      subject,
      body,
    });
    return JSON.stringify({
      ok: result.status === "draft",
      draft_id: result.externalId,
    });
  },
});

const judgeMode = process.env.JUDGE_MODE?.toLowerCase() === "true";
const sheetsClient = createSheetsClient({
  mode: "live",
  judgeMode,
  spreadsheetId: judgeMode
    ? process.env.JUDGE_SPREADSHEET_ID
    : process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  judgeSpreadsheetId: judgeMode ? process.env.JUDGE_SPREADSHEET_ID : undefined,
  range: process.env.GOOGLE_SHEETS_RANGE,
  accessToken: process.env.GOOGLE_ACCESS_TOKEN,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
});

export const appendGtmRecordTool = tool({
  name: "append_gtm_record",
  description: "Append the decision and execution result to the real Google Sheets log.",
  inputSchema: z.object({
    company: z.string().min(1),
    role: z.string().min(1),
    source_url: z.string().url(),
    match_score: z.number().min(0).max(100),
    decision: z.string().min(1),
    email_status: z.string().min(1),
    gmail_id: z.string().optional().default(""),
  }),
  callback: async ({ company, role, source_url, match_score, decision, email_status, gmail_id }) => {
    const result = await sheetsClient.appendResultRow({
      timestamp: new Date().toISOString(),
      company,
      role,
      sourceUrl: source_url,
      matchScore: match_score,
      decision,
      emailStatus: email_status,
    });
    return JSON.stringify({
      ok: result.status === "recorded",
      ...result,
      gmail_id,
    });
  },
});

export const STRANDS_TOOL_NAMES = [
  "greenhouse_search",
  "match_resume",
  "prepare_outreach",
  "create_gmail_draft",
  "append_gtm_record",
] as const;

export const odyvaStrandsAgent = new Agent({
  model,
  tools: [
    greenhouseSearchTool,
    matchResumeTool,
    prepareOutreachTool,
    createGmailDraftTool,
    appendGtmRecordTool,
  ],
  systemPrompt: SYSTEM_PROMPT,
  printer: false,
  toolExecutor: "sequential",
});

export { SYSTEM_PROMPT };
