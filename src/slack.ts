import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { NormalizedJob } from "./greenhouse.ts";
import type { OpportunityMatch } from "./matcher.ts";
import type { OutreachDraft } from "./gemini.ts";

export type ApprovalDecision = "approve" | "reject";

export interface ApprovalMessageInput {
  actionId: string;
  job: NormalizedJob;
  match: OpportunityMatch;
  outreach: OutreachDraft;
}

export interface SlackOptions {
  botToken?: string;
  channelId?: string;
  mode?: "live" | "mock";
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

export interface SlackPostResult {
  status: "posted" | "mock";
  actionId: string;
  channelId?: string;
  messageId?: string;
}

export interface SlackInteractionServerOptions {
  port: number;
  signingSecret?: string;
  onDecision: (decision: { actionId: string; decision: ApprovalDecision }) => Promise<void>;
}

export interface SlackInteractionServer {
  listen: () => Promise<void>;
  close: () => Promise<void>;
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildApprovalBlocks(input: ApprovalMessageInput): unknown[] {
  const why = input.match.reasons.map((reason) => "• " + escapeSlack(reason)).join("\n");
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "ODYVA OPPORTUNITY" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Company:* " +
          escapeSlack(input.job.company) +
          "\n*Role:* " +
          escapeSlack(input.job.role) +
          "\n*Match:* " +
          input.match.score +
          "%",
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Why it matches:*\n" + why },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Likely pain:* " +
          escapeSlack(input.outreach.likelyPain) +
          "\n*Outreach:*\n" +
          escapeSlack(input.outreach.body),
      },
    },
    {
      type: "actions",
      block_id: "odyva_approval_" + input.actionId,
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve + Send" },
          style: "primary",
          action_id: "odyva_approve",
          value: JSON.stringify({ actionId: input.actionId, decision: "approve" }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "odyva_reject",
          value: JSON.stringify({ actionId: input.actionId, decision: "reject" }),
        },
      ],
    },
  ];
}

export function parseApprovalDecision(value: string | undefined): ApprovalDecision | undefined {
  if (value === "approve" || value === "approved") return "approve";
  if (value === "reject" || value === "rejected") return "reject";
  return undefined;
}

export function parseSlackInteraction(payload: unknown): { actionId: string; decision: ApprovalDecision } | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (record.type !== "block_actions" || !Array.isArray(record.actions) || record.actions.length === 0) {
    return undefined;
  }
  const action = record.actions[0] as Record<string, unknown>;
  const value = typeof action.value === "string" ? action.value : "";
  try {
    const parsed = JSON.parse(value) as { actionId?: string; decision?: string };
    const decision = parseApprovalDecision(parsed.decision);
    if (parsed.actionId && decision) return { actionId: parsed.actionId, decision };
  } catch {
    return undefined;
  }
  return undefined;
}

function validSlackSignature(rawBody: string, timestamp: string | undefined, signature: string | undefined, signingSecret: string): boolean {
  if (!timestamp || !signature) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }
  const base = "v0:" + timestamp + ":" + rawBody;
  const expected = "v0=" + createHmac("sha256", signingSecret).update(base).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function createSlackInteractionServer(options: SlackInteractionServerOptions): SlackInteractionServer {
  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/slack/interactions") {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const signature = Array.isArray(request.headers["x-slack-signature"])
        ? request.headers["x-slack-signature"][0]
        : request.headers["x-slack-signature"];
      const timestamp = Array.isArray(request.headers["x-slack-request-timestamp"])
        ? request.headers["x-slack-request-timestamp"][0]
        : request.headers["x-slack-request-timestamp"];
      if (options.signingSecret && !validSlackSignature(rawBody, timestamp, signature, options.signingSecret)) {
        response.statusCode = 401;
        response.end("Invalid Slack signature");
        return;
      }

      const payloadText = new URLSearchParams(rawBody).get("payload");
      if (!payloadText) {
        response.statusCode = 400;
        response.end("Missing payload");
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        response.statusCode = 400;
        response.end("Invalid payload");
        return;
      }
      const decision = parseSlackInteraction(payload);
      if (!decision) {
        response.statusCode = 400;
        response.end("Unsupported interaction");
        return;
      }

      response.statusCode = 200;
      response.end();
      void options.onDecision(decision).catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
      });
    });
  });

  return {
    listen: () => new Promise<void>((resolve) => server.listen(options.port, "0.0.0.0", resolve)),
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

export async function postApproval(
  input: ApprovalMessageInput,
  options: SlackOptions = {},
): Promise<SlackPostResult> {
  const mode = options.mode || (options.botToken && options.channelId ? "live" : "mock");
  if (mode === "mock") {
    return { status: "mock", actionId: input.actionId, channelId: options.channelId };
  }
  if (!options.botToken || !options.channelId) {
    throw new Error("Slack: SLACK_BOT_TOKEN and SLACK_CHANNEL_ID are required in live mode");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: "Bearer " + options.botToken,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: options.channelId,
      text:
        "Odyva opportunity: " +
        input.job.company +
        " — " +
        input.job.role +
        " (" +
        input.match.score +
        "% match)",
      blocks: buildApprovalBlocks(input),
    }),
  });
  const payload = (await response.json()) as { ok?: boolean; ts?: string; error?: string };
  if (!response.ok || payload.ok !== true) {
    throw new Error("Slack: chat.postMessage failed" + (payload.error ? ": " + payload.error : ""));
  }
  return {
    status: "posted",
    actionId: input.actionId,
    channelId: options.channelId,
    messageId: payload.ts,
  };
}
