import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fetchGreenhouseJobs, normalizeGreenhouseJob } from "./greenhouse.ts";
import type { GreenhouseJobRecord, NormalizedJob } from "./greenhouse.ts";
import { generateOutreach } from "./gemini.ts";
import { createGmailClient } from "./gmail.ts";
import { runFlow, type FlowDependencies, type FlowRecord } from "./hermes.ts";
import type { CapabilityProfile } from "./matcher.ts";
import { createSlackInteractionServer, createSlackSocketModeClient, extractPdfText, postApproval } from "./slack.ts";
import { createSheetsClient } from "./sheets.ts";
import { getResult, saveResult } from "./storage.ts";

const judgeMode = process.env.JUDGE_MODE?.toLowerCase() === "true";

function parseAllowlist(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const judgeAllowedUsers = parseAllowlist(process.env.JUDGE_SLACK_ALLOWED_USERS);

function appWorkspacePath(filePath: string): string {
  const appRoot = resolve(process.cwd());
  const target = resolve(filePath);
  const relativePath = relative(appRoot, target);
  if (relativePath === ".." || relativePath.startsWith(".." + sep) || isAbsolute(relativePath)) {
    throw new Error("JUDGE_MODE: filesystem paths must stay inside the app workspace");
  }
  return filePath;
}

const resultsPath = judgeMode
  ? appWorkspacePath(process.env.RESULTS_PATH || "workspace/judge/results.json")
  : process.env.RESULTS_PATH || "data/results.json";

function requireJudgeValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("JUDGE_MODE: " + name + " is required");
  return value;
}

function validateJudgeConfiguration(): void {
  if (!judgeMode) return;
  if (process.env.EMAIL_MODE !== "draft") throw new Error("JUDGE_MODE: EMAIL_MODE must be draft");
  if (process.env.SHEETS_MODE !== "live") throw new Error("JUDGE_MODE: SHEETS_MODE must be live");
  if (process.env.SLACK_MODE !== "live") throw new Error("JUDGE_MODE: SLACK_MODE must be live");
  if (process.env.SLACK_SOCKET_MODE !== "true") throw new Error("JUDGE_MODE: SLACK_SOCKET_MODE must be true");
  if (process.env.SLACK_WAIT_FOR_APPROVAL !== "true") {
    throw new Error("JUDGE_MODE: SLACK_WAIT_FOR_APPROVAL must be true");
  }
  if (process.env.GEMINI_MODE !== "live") throw new Error("JUDGE_MODE: GEMINI_MODE must be live");
  if (process.env.GATEWAY_ALLOW_ALL_USERS?.toLowerCase() === "true") {
    throw new Error("JUDGE_MODE: GATEWAY_ALLOW_ALL_USERS must not be enabled");
  }
  if (judgeAllowedUsers.length === 0) {
    throw new Error("JUDGE_MODE: JUDGE_SLACK_ALLOWED_USERS must contain at least one user ID");
  }
  requireJudgeValue("JUDGE_SLACK_WORKSPACE_ID");
  requireJudgeValue("JUDGE_SLACK_CHANNEL_ID");
  requireJudgeValue("JUDGE_GMAIL_TO");
  requireJudgeValue("JUDGE_SPREADSHEET_ID");
  const ttlMs = Number(process.env.JUDGE_WORKSPACE_TTL_MS || 900000);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("JUDGE_MODE: JUDGE_WORKSPACE_TTL_MS must be a positive number");
  }
  if (process.env.GREENHOUSE_FIXTURE_PATH) {
    throw new Error("JUDGE_MODE: GREENHOUSE_FIXTURE_PATH is not allowed; use live Greenhouse data");
  }
}

function recipientEmail(): string | undefined {
  return judgeMode ? process.env.JUDGE_GMAIL_TO : process.env.GMAIL_TO;
}

interface HealthServer {
  listen: () => Promise<void>;
  close: () => Promise<void>;
}

function createHealthServer(port: number): HealthServer {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ status: "ok", service: "odyva-gtm" }));
      return;
    }
    response.statusCode = 404;
    response.end("Not found");
  });

  return {
    listen: () => new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve)),
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function loadProfile(): Promise<CapabilityProfile> {
  const raw = await readFile("data/capability_profile.json", "utf8");
  if (raw.trim().length === 0) {
    throw new Error("Capability profile is empty");
  }
  return JSON.parse(raw) as CapabilityProfile;
}

async function loadJobs(): Promise<NormalizedJob[]> {
  const fixturePath = process.env.GREENHOUSE_FIXTURE_PATH;
  if (fixturePath) {
    if (judgeMode) {
      throw new Error("JUDGE_MODE: fixture Greenhouse data is disabled");
    }
    const raw = await readFile(fixturePath, "utf8");
    const parsed = JSON.parse(raw) as GreenhouseJobRecord[] | { jobs?: GreenhouseJobRecord[] };
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs || [];
    return jobs.map((job) =>
      normalizeGreenhouseJob(
        job,
        process.env.GREENHOUSE_COMPANY || "Fixture company",
        process.env.GREENHOUSE_BOARD_TOKEN || "fixture",
      ),
    );
  }
  return fetchGreenhouseJobs(process.env.GREENHOUSE_BOARD_TOKEN || "", {
    company: process.env.GREENHOUSE_COMPANY,
  });
}

function publicResult(result: FlowRecord): Record<string, unknown> {
  return {
    status: result.status,
    decision: result.decision,
    company: result.job.company,
    role: result.job.role,
    sourceUrl: result.job.sourceUrl,
    match: result.match,
    outreach: result.outreach,
    emailStatus: result.emailStatus,
    emailExternalId: result.emailExternalId,
    emailDraftId: result.emailDraftId,
    sheetStatus: result.sheetStatus,
    actionId: result.actionId,
  };
}

function createDependencies(): FlowDependencies {
  const emailMode = (process.env.GMAIL_MODE || process.env.EMAIL_MODE) as
    ("dry_run" | "draft" | "live" | undefined);
  const gmail = createGmailClient({
    mode: emailMode || "dry_run",
    judgeMode,
    accessToken: process.env.GMAIL_ACCESS_TOKEN,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  });
  const sheets = createSheetsClient({
    mode: process.env.SHEETS_MODE as "live" | "mock" | undefined,
    judgeMode,
    spreadsheetId: judgeMode ? process.env.JUDGE_SPREADSHEET_ID : process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    judgeSpreadsheetId: judgeMode ? process.env.JUDGE_SPREADSHEET_ID : undefined,
    range: process.env.GOOGLE_SHEETS_RANGE,
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return {
    fetchJobs: loadJobs,
    generateOutreach: (job, profile, match) =>
      generateOutreach(job, profile, match, {
        mode: process.env.GEMINI_MODE as "live" | "mock" | undefined,
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL,
      }),
    postApproval: (input) =>
      postApproval(input, {
        mode: process.env.SLACK_MODE as "live" | "mock" | undefined,
        botToken: process.env.SLACK_BOT_TOKEN,
        channelId: judgeMode ? process.env.JUDGE_SLACK_CHANNEL_ID : process.env.SLACK_CHANNEL_ID,
        judgeMode,
        judgeChannelId: judgeMode ? process.env.JUDGE_SLACK_CHANNEL_ID : undefined,
      }),
    sendApprovedEmail: gmail.sendApprovedEmail,
    createEmailDraft: gmail.createDraft,
    sendEmailDraft: gmail.sendDraft,
    appendSheetRow: sheets.appendResultRow,
    saveResult: (record) => saveResult(record, resultsPath),
    getResult: async (actionId) => (await getResult(actionId, resultsPath)) as FlowRecord | undefined,
  };
}

async function waitForSlackApproval(profile: CapabilityProfile, pending: FlowRecord, dependencies: FlowDependencies): Promise<void> {
  if (process.env.SLACK_SOCKET_MODE === "true") {
    let client: ReturnType<typeof createSlackSocketModeClient>;
    let handled = false;
    client = createSlackSocketModeClient({
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      judgeMode,
      judgeChannelId: judgeMode ? process.env.JUDGE_SLACK_CHANNEL_ID : undefined,
      judgeWorkspaceId: judgeMode ? process.env.JUDGE_SLACK_WORKSPACE_ID : undefined,
      allowedUserIds: judgeMode ? judgeAllowedUsers : undefined,
      fileIngestion: {
        workspaceRoot: judgeMode ? process.env.JUDGE_WORKSPACE_ROOT : undefined,
        ttlMs: judgeMode ? Number(process.env.JUDGE_WORKSPACE_TTL_MS || 900000) : undefined,
      },
      onMessage: async (message) => {
        for (const attachment of message.attachments) {
          if (attachment.mime_type !== "application/pdf") continue;
          const resumeText = await extractPdfText(attachment.path);
          console.log(JSON.stringify({
            status: "slack_file_ingested",
            fileId: attachment.slack_file_id,
            localPath: attachment.path,
            cloudUri: attachment.cloud_uri || null,
            resumeChars: resumeText.length,
          }, null, 2));
        }
      },
      onDecision: async ({ actionId, decision }) => {
        if (handled) return;
        if (actionId !== pending.actionId) {
          throw new Error("slack: received an action for a different opportunity");
        }
        handled = true;
        const resumed = await runFlow({
          profile,
          decision,
          recipientEmail: recipientEmail(),
          dependencies: {
            ...dependencies,
            fetchJobs: async () => [pending.job],
            generateOutreach: async () => pending.outreach,
            postApproval: async () => pending.slack,
          },
          draftId: pending.emailDraftId,
        });
        console.log(JSON.stringify(publicResult(resumed), null, 2));
        await client.close();
      },
    });
    await client.connect();
    console.log(JSON.stringify({
      status: "waiting_for_slack_approval",
      transport: "socket_mode",
      actionId: pending.actionId,
    }, null, 2));
    await new Promise<void>(() => {});
    return;
  }

  let server: ReturnType<typeof createSlackInteractionServer>;
  server = createSlackInteractionServer({
    port: Number(process.env.SLACK_PORT || 3000),
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    onDecision: async ({ actionId, decision }) => {
      if (actionId !== pending.actionId) {
        throw new Error("slack: received an action for a different opportunity");
      }
      const resumed = await runFlow({
        profile,
        decision,
        recipientEmail: recipientEmail(),
        dependencies: {
          ...dependencies,
          fetchJobs: async () => [pending.job],
          generateOutreach: async () => pending.outreach,
          postApproval: async () => pending.slack,
        },
        draftId: pending.emailDraftId,
      });
      console.log(JSON.stringify(publicResult(resumed), null, 2));
      await server.close();
    },
  });
  await server.listen();
  console.log(JSON.stringify({
    status: "waiting_for_slack_approval",
    callbackPath: "/slack/interactions",
    port: Number(process.env.SLACK_PORT || 3000),
    actionId: pending.actionId,
  }, null, 2));
  await new Promise<void>(() => {});
}

async function main(): Promise<void> {
  validateJudgeConfiguration();
  const healthServer = createHealthServer(Number(process.env.HEALTH_PORT || 3001));
  await healthServer.listen();
  try {
    const profile = await loadProfile();
    const dependencies = createDependencies();
    const result = await runFlow({
      profile,
      recipientEmail: recipientEmail(),
      dependencies,
    });
    console.log(JSON.stringify(publicResult(result), null, 2));

    if (result.status === "awaiting_approval" && process.env.SLACK_WAIT_FOR_APPROVAL === "true") {
      await waitForSlackApproval(profile, result, dependencies);
    }
  } catch (error) {
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
