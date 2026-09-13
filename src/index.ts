import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fetchGreenhouseJobs, normalizeGreenhouseJob } from "./greenhouse.ts";
import type { GreenhouseJobRecord, NormalizedJob } from "./greenhouse.ts";
import { generateOutreach } from "./gemini.ts";
import { createGmailClient } from "./gmail.ts";
import { runFlow, type FlowDependencies, type FlowRecord } from "./hermes.ts";
import type { CapabilityProfile } from "./matcher.ts";
import { createSlackInteractionServer, createSlackSocketModeClient, postApproval } from "./slack.ts";
import { createSheetsClient } from "./sheets.ts";
import { getResult, saveResult } from "./storage.ts";

const resultsPath = process.env.RESULTS_PATH || "data/results.json";

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
    sheetStatus: result.sheetStatus,
    actionId: result.actionId,
  };
}

function createDependencies(): FlowDependencies {
  const gmail = createGmailClient({
    mode: (process.env.EMAIL_MODE as "dry_run" | "draft" | "live" | undefined) || "dry_run",
    accessToken: process.env.GMAIL_ACCESS_TOKEN,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  });
  const sheets = createSheetsClient({
    mode: process.env.SHEETS_MODE as "live" | "mock" | undefined,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
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
        channelId: process.env.SLACK_CHANNEL_ID,
      }),
    sendApprovedEmail: gmail.sendApprovedEmail,
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
      appToken: process.env.SLACK_APP_TOKEN,
      onDecision: async ({ actionId, decision }) => {
        if (handled) return;
        if (actionId !== pending.actionId) {
          throw new Error("slack: received an action for a different opportunity");
        }
        handled = true;
        const resumed = await runFlow({
          profile,
          decision,
          recipientEmail: process.env.GMAIL_TO,
          dependencies: {
            ...dependencies,
            fetchJobs: async () => [pending.job],
            generateOutreach: async () => pending.outreach,
            postApproval: async () => pending.slack,
          },
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
        recipientEmail: process.env.GMAIL_TO,
        dependencies: {
          ...dependencies,
          fetchJobs: async () => [pending.job],
          generateOutreach: async () => pending.outreach,
          postApproval: async () => pending.slack,
        },
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
  const healthServer = createHealthServer(Number(process.env.HEALTH_PORT || 3001));
  await healthServer.listen();
  try {
    const profile = await loadProfile();
    const dependencies = createDependencies();
    const result = await runFlow({
      profile,
      recipientEmail: process.env.GMAIL_TO,
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
