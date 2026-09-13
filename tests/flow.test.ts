import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGreenhouseJob } from "../src/greenhouse.ts";
import { matchOpportunity } from "../src/matcher.ts";
import { runFlow, type FlowDependencies, type FlowRecord } from "../src/hermes.ts";
import type { NormalizedJob } from "../src/greenhouse.ts";
import type { OutreachDraft } from "../src/gemini.ts";
import type { CapabilityProfile } from "../src/matcher.ts";

const profile: CapabilityProfile = {
  name: "candidate",
  positioning: "AI creative director and GTM operator",
  skills: ["AI automation", "GTM systems", "workflow design", "TypeScript"],
  technologies: [],
  experience: [],
  results: [],
  case_studies: [],
  constraints: [],
};

const job: NormalizedJob = {
  id: "job-1",
  company: "Acme",
  role: "Founding Growth Engineer",
  sourceUrl: "https://example.com/job-1",
  description: "Build outbound automation and GTM systems with TypeScript and workflow design.",
  postedAt: "2026-09-13T06:00:00.000Z",
};

const outreach: OutreachDraft = {
  likelyPain: "The company is building repeatable growth operations.",
  whyFit: "The role overlaps with verified capabilities.",
  recipientRole: "Hiring owner",
  subject: "A thought on your growth systems",
  body: "Hi there. I saw the open growth role. I have verified automation experience. Would a short conversation be useful?",
  evidenceUsed: ["AI automation", "GTM systems", "workflow design", "TypeScript"],
};

function dependencies(overrides: Partial<FlowDependencies> = {}) {
  const saved = new Map<string, FlowRecord>();
  let emailCalls = 0;
  let sheetCalls = 0;
  const base: FlowDependencies = {
    fetchJobs: async () => [job],
    generateOutreach: async () => outreach,
    postApproval: async (input) => ({
      status: "mock",
      actionId: input.actionId,
    }),
    sendApprovedEmail: async (input) => {
      emailCalls += 1;
      return { actionId: input.actionId, status: "dry_run", externalId: "dry-run" };
    },
    appendSheetRow: async () => {
      sheetCalls += 1;
      return { status: "recorded" };
    },
    saveResult: async (record) => {
      saved.set(record.actionId, structuredClone(record));
    },
    getResult: async (actionId) => saved.get(actionId),
  };
  return {
    deps: { ...base, ...overrides },
    saved,
    counts: () => ({ emailCalls, sheetCalls }),
  };
}

test("normalizes a Greenhouse job", () => {
  const normalized = normalizeGreenhouseJob({
    id: 42,
    title: "Growth Engineer",
    absolute_url: "https://boards.greenhouse.io/acme/jobs/42",
    content: "<p>Build automation.</p>",
    updated_at: "2026-09-13T08:00:00.000Z",
  }, "Acme", "acme");
  assert.deepEqual(normalized, {
    id: "42",
    company: "Acme",
    role: "Growth Engineer",
    sourceUrl: "https://boards.greenhouse.io/acme/jobs/42",
    description: "Build automation.",
    postedAt: "2026-09-13T08:00:00.000Z",
  });
});

test("fetches and normalizes Greenhouse data through the public board endpoint", async () => {
  const jobs = await (await import("../src/greenhouse.ts")).fetchGreenhouseJobs("acme", {
    company: "Acme",
    baseUrl: "https://example.test",
    fetchImpl: async (input) => {
      assert.equal(String(input), "https://example.test/v1/boards/acme/jobs?content=true");
      return new Response(JSON.stringify({
        jobs: [{
          id: 7,
          title: "Growth Engineer",
          absolute_url: "https://boards.greenhouse.io/acme/jobs/7",
          content: "<p>Build automation.</p>",
          updated_at: "2026-09-13T08:00:00.000Z",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(jobs[0].company, "Acme");
  assert.equal(jobs[0].id, "7");
});

test("calculates an explainable deterministic match", () => {
  const match = matchOpportunity(job, profile, new Date("2026-09-13T12:00:00.000Z"));
  assert.equal(match.capabilityFit, 100);
  assert.equal(match.intent, 100);
  assert.equal(match.evidence, 100);
  assert.equal(match.score, 100);
  assert.ok(match.reasons.length >= 3);
});

test("builds a grounded mock Gemini draft", async () => {
  const { generateOutreach } = await import("../src/gemini.ts");
  const draft = await generateOutreach(job, profile, matchOpportunity(job, profile, new Date("2026-09-13T12:00:00.000Z")), { mode: "mock" });
  assert.match(draft.body, /Founding Growth Engineer/);
  assert.deepEqual(draft.evidenceUsed, ["AI automation", "GTM systems", "workflow design", "TypeScript"]);
});

test("parses a valid Slack approval payload", async () => {
  const { parseSlackInteraction } = await import("../src/slack.ts");
  assert.deepEqual(parseSlackInteraction({
    type: "block_actions",
    actions: [{
      action_id: "approve_send",
      value: JSON.stringify({ actionId: "abc123", decision: "approve" }),
    }],
  }), { actionId: "abc123", decision: "approve" });
});

test("happy path performs one email action and one sheet row", async () => {
  const setup = dependencies();
  const result = await runFlow({
    profile,
    decision: "approve",
    dependencies: setup.deps,
    recipientEmail: "demo@example.com",
    now: new Date("2026-09-13T12:00:00.000Z"),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.emailStatus, "dry_run");
  assert.equal(result.sheetStatus, "recorded");
  assert.deepEqual(setup.counts(), { emailCalls: 1, sheetCalls: 1 });
});

test("reject path performs no email action and records the decision", async () => {
  const setup = dependencies();
  const result = await runFlow({
    profile,
    decision: "reject",
    dependencies: setup.deps,
    now: new Date("2026-09-13T12:00:00.000Z"),
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.emailStatus, "not_attempted");
  assert.deepEqual(setup.counts(), { emailCalls: 0, sheetCalls: 1 });
});

test("duplicate approval is idempotent", async () => {
  const setup = dependencies();
  const options = {
    profile,
    decision: "approve" as const,
    dependencies: setup.deps,
    recipientEmail: "demo@example.com",
    now: new Date("2026-09-13T12:00:00.000Z"),
  };
  await runFlow(options);
  const second = await runFlow(options);
  assert.equal(second.emailStatus, "dry_run");
  assert.deepEqual(setup.counts(), { emailCalls: 1, sheetCalls: 1 });
});

test("Gemini failure stops before external actions", async () => {
  const setup = dependencies({
    generateOutreach: async () => {
      throw new Error("model unavailable");
    },
  });
  await assert.rejects(
    runFlow({ profile, dependencies: setup.deps }),
    /gemini: model unavailable/,
  );
  assert.deepEqual(setup.counts(), { emailCalls: 0, sheetCalls: 0 });
});

test("Gmail failure is recorded and surfaced", async () => {
  const setup = dependencies({
    sendApprovedEmail: async () => {
      throw new Error("provider unavailable");
    },
  });
  await assert.rejects(
    runFlow({
      profile,
      decision: "approve",
      dependencies: setup.deps,
      recipientEmail: "demo@example.com",
    }),
    /gmail: provider unavailable/,
  );
  const saved = Array.from(setup.saved.values())[0];
  assert.equal(saved.emailStatus, "failed");
  assert.equal(saved.status, "failed");
});

test("Google Sheets failure is recorded without false completion", async () => {
  const setup = dependencies({
    appendSheetRow: async () => {
      throw new Error("sheet unavailable");
    },
  });
  await assert.rejects(
    runFlow({
      profile,
      decision: "approve",
      dependencies: setup.deps,
      recipientEmail: "demo@example.com",
    }),
    /google_sheets: sheet unavailable/,
  );
  const saved = Array.from(setup.saved.values())[0];
  assert.equal(saved.emailStatus, "dry_run");
  assert.equal(saved.sheetStatus, "failed");
  assert.equal(saved.status, "partial_failure");
});

test("Gmail client enforces dry-run idempotency", async () => {
  const { createGmailClient } = await import("../src/gmail.ts");
  const client = createGmailClient({ mode: "dry_run" });
  const input = { actionId: "same-action", to: "demo@example.com", subject: "Test", body: "Hello" };
  await client.sendApprovedEmail(input);
  await client.sendApprovedEmail(input);
  assert.equal((await client.sendApprovedEmail(input)).externalId, "dry-run:same-action");
});

test("judge mode refuses non-draft Gmail", async () => {
  const { createGmailClient } = await import("../src/gmail.ts");
  const client = createGmailClient({ mode: "live", judgeMode: true });
  await assert.rejects(
    client.sendApprovedEmail({ actionId: "judge-email", to: "judge@example.com", subject: "Test", body: "Hello" }),
    /JUDGE_MODE requires EMAIL_MODE=draft/,
  );
});

test("judge mode refuses a non-dedicated Google Sheet", async () => {
  const { createSheetsClient } = await import("../src/sheets.ts");
  const client = createSheetsClient({
    mode: "live",
    judgeMode: true,
    spreadsheetId: "production-sheet",
    judgeSpreadsheetId: "judge-sheet",
  });
  await assert.rejects(
    client.appendResultRow({
      timestamp: "2026-09-14T00:00:00.000Z",
      company: "Acme",
      role: "Growth Engineer",
      sourceUrl: "https://example.com/job-1",
      matchScore: 90,
      decision: "approve",
      emailStatus: "draft",
    }),
    /dedicated judge spreadsheet/,
  );
});

test("judge mode refuses posting outside the dedicated Slack channel", async () => {
  const { postApproval } = await import("../src/slack.ts");
  await assert.rejects(
    postApproval({
      actionId: "judge-slack",
      job,
      match: matchOpportunity(job, profile, new Date("2026-09-13T12:00:00.000Z")),
      outreach,
    }, {
      mode: "live",
      judgeMode: true,
      botToken: "token-placeholder",
      channelId: "C-production",
      judgeChannelId: "C-judge",
    }),
    /dedicated judge channel/,
  );
});
