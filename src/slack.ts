import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { App } from "@slack/bolt";
import type { NormalizedJob } from "./greenhouse.ts";
import type { OpportunityMatch } from "./matcher.ts";
import type { OutreachDraft } from "./gemini.ts";

const execFileAsync = promisify(execFile);

export type ApprovalDecision = "approve" | "reject";

export interface ApprovalMessageInput {
  actionId: string;
  job: NormalizedJob;
  match: OpportunityMatch;
  outreach: OutreachDraft;
}

export interface SlackJudgePolicy {
  judgeMode?: boolean;
  judgeChannelId?: string;
  judgeWorkspaceId?: string;
  allowedUserIds?: readonly string[];
}

export interface SlackOptions extends SlackJudgePolicy {
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

export interface SlackSocketModeOptions extends SlackJudgePolicy {
  botToken?: string;
  appToken?: string;
  onDecision: (decision: { actionId: string; decision: ApprovalDecision }) => Promise<void>;
  onMessage?: (message: NormalizedSlackMessage) => Promise<void>;
  fileIngestion?: Omit<SlackFileIngestionOptions, "botToken">;
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

export interface SlackSocketModeClient {
  connect: () => Promise<void>;
  close: () => Promise<void>;
}

export interface SlackAttachmentMetadata {
  slack_file_id: string;
  filename: string;
  mimetype: string;
  local_path: string;
  cloud_uri?: string;
  channel_id?: string;
  thread_ts?: string;
  user_id?: string;
  downloaded_at: string;
}

export interface SlackNormalizedAttachment extends SlackAttachmentMetadata {
  id: string;
  name: string;
  type: string;
  path: string;
  mime_type: string;
}

export interface NormalizedSlackMessage {
  platform: "slack";
  user_id?: string;
  channel_id?: string;
  text: string;
  thread_ts?: string;
  attachments: SlackNormalizedAttachment[];
}

export interface SlackFileIngestionOptions extends SlackJudgePolicy {
  botToken?: string;
  workspaceRoot?: string;
  ttlMs?: number;
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  getThreadMessages?: (channelId: string, threadTs: string) => Promise<unknown[]>;
  persist?: (input: {
    metadata: SlackAttachmentMetadata;
    bytes: Uint8Array;
  }) => Promise<string | undefined>;
}

export interface SlackInboundMessageEvent {
  type?: string;
  subtype?: string;
  user?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  text?: string;
  files?: unknown[];
  file_id?: string;
  file_ids?: string[];
  team?: string;
  team_id?: string;
}

interface SlackWebSocket {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  send: (data: string) => void;
  close: () => void;
}

type SlackWebSocketConstructor = new (url: string) => SlackWebSocket;

interface SlackFileRecord {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  mimetype?: unknown;
  url_private_download?: unknown;
  url_private?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function idValue(value: unknown): string | undefined {
  if (typeof value === "string") return stringValue(value);
  return stringValue(asRecord(value)?.id);
}

function judgeContextAllowed(value: unknown, policy: SlackJudgePolicy): boolean {
  if (!policy.judgeMode) return true;
  const record = asRecord(value);
  const channelId =
    idValue(record?.channel) ||
    stringValue(asRecord(record?.container)?.channel_id) ||
    stringValue(record?.channel_id);
  const workspaceId =
    idValue(record?.team) ||
    stringValue(record?.team_id) ||
    stringValue(record?.workspaceId) ||
    stringValue(record?.workspace_id);
  const userId = idValue(record?.user) || stringValue(record?.user_id);
  return Boolean(
    policy.judgeChannelId &&
      channelId === policy.judgeChannelId &&
      policy.allowedUserIds?.includes(userId || "") &&
      (!policy.judgeWorkspaceId || workspaceId === policy.judgeWorkspaceId),
  );
}

function assertJudgeContext(value: unknown, policy: SlackJudgePolicy): void {
  if (policy.judgeMode && !judgeContextAllowed(value, policy)) {
    throw new Error("Slack: judge policy rejected this user, workspace, or channel");
  }
}

function slackWorkspaceRoot(options: SlackFileIngestionOptions): string {
  const configuredRoot =
    options.workspaceRoot ||
    (options.judgeMode ? process.env.JUDGE_WORKSPACE_ROOT : process.env.SLACK_WORKSPACE_ROOT) ||
    (options.judgeMode ? join(process.cwd(), "workspace", "judge") : "/opt/odyva-gtm/workspace/slack");
  if (!options.judgeMode) return configuredRoot;

  const appRoot = resolve(process.cwd());
  const root = resolve(configuredRoot);
  const relativeRoot = relative(appRoot, root);
  if (relativeRoot === ".." || relativeRoot.startsWith(".." + sep) || isAbsolute(relativeRoot)) {
    throw new Error("Slack: JUDGE_WORKSPACE_ROOT must stay inside the app workspace");
  }
  return root;
}

function judgeTtlMs(options: SlackFileIngestionOptions): number {
  const configured = options.ttlMs ?? Number(process.env.JUDGE_WORKSPACE_TTL_MS || 900000);
  return Number.isFinite(configured) && configured > 0 ? configured : 900000;
}

async function cleanupJudgeWorkspace(root: string, ttlMs: number): Promise<void> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const cutoff = Date.now() - ttlMs;
  for (const entry of entries) {
    const entryPath = join(root, entry.name);
    try {
      const details = await stat(entryPath);
      if (details.mtimeMs < cutoff) {
        await rm(entryPath, { recursive: true, force: true });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

function scheduleJudgeCleanup(root: string, ttlMs: number): void {
  const timer = setTimeout(() => {
    void cleanupJudgeWorkspace(root, ttlMs).catch(() => undefined);
  }, ttlMs);
  timer.unref?.();
}

function safePathPart(value: string | undefined, fallback: string): string {
  const safe = (value || fallback)
    .replace(/\.\./g, "_")
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^\.+$/, "_")
    .slice(0, 180);
  return safe || fallback;
}

function fileIdFrom(value: unknown): string | undefined {
  if (typeof value === "string") return stringValue(value);
  return stringValue(asRecord(value)?.id);
}

function fileReferencesFrom(message: SlackInboundMessageEvent): unknown[] {
  const references: unknown[] = Array.isArray(message.files) ? [...message.files] : [];
  const ids = [
    ...(Array.isArray(message.file_ids) ? message.file_ids : []),
    message.file_id,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const seen = new Set(references.map(fileIdFrom).filter((value): value is string => Boolean(value)));
  for (const id of ids) {
    if (!seen.has(id)) {
      references.push(id);
      seen.add(id);
    }
  }
  return references;
}

async function fetchSlackFileInfo(fileId: string, options: SlackFileIngestionOptions): Promise<SlackFileRecord> {
  if (!options.botToken) throw new Error("Slack: SLACK_BOT_TOKEN is required for files.info");
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(
    "https://slack.com/api/files.info?file=" + encodeURIComponent(fileId),
    { headers: { authorization: "Bearer " + options.botToken } },
  );
  const payload = await response.json() as { ok?: boolean; error?: string; file?: SlackFileRecord };
  if (!response.ok || payload.ok !== true || !payload.file) {
    throw new Error("Slack: files.info failed" + (payload.error ? ": " + payload.error : ""));
  }
  return payload.file;
}

async function resolveSlackFileRecord(reference: unknown, options: SlackFileIngestionOptions): Promise<SlackFileRecord> {
  const supplied = typeof reference === "string" ? { id: reference } : asRecord(reference);
  const fileId = fileIdFrom(reference);
  if (!fileId) throw new Error("Slack: incoming attachment is missing a file id");
  const hasPrivateUrl = Boolean(stringValue(supplied?.url_private_download) || stringValue(supplied?.url_private));
  if (!options.judgeMode && hasPrivateUrl && stringValue(supplied?.name || supplied?.title)) {
    return supplied as SlackFileRecord;
  }
  return { ...await fetchSlackFileInfo(fileId, options), ...supplied } as SlackFileRecord;
}

export async function downloadSlackFile(
  reference: unknown,
  context: { channelId?: string; threadTs?: string; userId?: string; workspaceId?: string } = {},
  options: SlackFileIngestionOptions = {},
): Promise<SlackAttachmentMetadata> {
  assertJudgeContext(context, options);
  if (!options.botToken) throw new Error("Slack: SLACK_BOT_TOKEN is required for file download");
  const file = await resolveSlackFileRecord(reference, options);
  const fileId = fileIdFrom(file);
  if (!fileId) throw new Error("Slack: resolved attachment is missing a file id");
  const downloadUrl = stringValue(file.url_private_download) || stringValue(file.url_private);
  if (!downloadUrl) throw new Error("Slack: files.info returned no private download URL");

  const filename = safePathPart(stringValue(file.name) || stringValue(file.title), fileId);
  const root = slackWorkspaceRoot(options);
  const ttlMs = judgeTtlMs(options);
  if (options.judgeMode) await cleanupJudgeWorkspace(root, ttlMs);
  const localPath = join(
    root,
    safePathPart(context.channelId, "unknown-channel"),
    safePathPart(context.threadTs, "root"),
    safePathPart(fileId, fileId),
    filename,
  );
  await mkdir(dirname(localPath), { recursive: true });

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(downloadUrl, {
    headers: { authorization: "Bearer " + options.botToken },
  });
  if (!response.ok) {
    throw new Error("Slack: file download failed with HTTP " + response.status);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(localPath, bytes);

  const metadata: SlackAttachmentMetadata = {
    slack_file_id: fileId,
    filename,
    mimetype: stringValue(file.mimetype) || "application/octet-stream",
    local_path: localPath,
    channel_id: context.channelId,
    thread_ts: context.threadTs,
    user_id: context.userId,
    downloaded_at: new Date().toISOString(),
  };
  if (options.persist) {
    metadata.cloud_uri = await options.persist({ metadata, bytes });
  }
  await writeFile(localPath + ".metadata.json", JSON.stringify(metadata, null, 2) + "\n", "utf8");
  if (options.judgeMode) scheduleJudgeCleanup(root, ttlMs);
  return metadata;
}

export async function ingestSlackMessage(
  message: SlackInboundMessageEvent,
  options: SlackFileIngestionOptions = {},
): Promise<NormalizedSlackMessage> {
  assertJudgeContext(message, options);
  const channelId = stringValue(message.channel);
  const threadTs = stringValue(message.thread_ts);
  let references = fileReferencesFrom(message);
  if (references.length === 0 && channelId && threadTs && options.getThreadMessages) {
    const threadMessages = await options.getThreadMessages(channelId, threadTs);
    references = threadMessages
      .filter((item) => {
        if (!options.judgeMode) return true;
        const record = asRecord(item) || {};
        return judgeContextAllowed({
          ...record,
          channel: channelId,
          team_id: stringValue(record.team_id) || stringValue(message.team_id) || stringValue(message.team),
        }, options);
      })
      .flatMap((item) => fileReferencesFrom(asRecord(item) as SlackInboundMessageEvent));
  }

  const attachments: SlackNormalizedAttachment[] = [];
  for (const reference of references) {
    const metadata = await downloadSlackFile(reference, {
      channelId,
      threadTs: threadTs || stringValue(message.ts),
      userId: stringValue(message.user),
      workspaceId: stringValue(message.team) || stringValue(message.team_id),
    }, options);
    attachments.push({
      ...metadata,
      id: metadata.slack_file_id,
      name: metadata.filename,
      type: metadata.mimetype,
      path: metadata.local_path,
      mime_type: metadata.mimetype,
    });
  }

  return {
    platform: "slack",
    user_id: stringValue(message.user),
    channel_id: channelId,
    text: stringValue(message.text) || "",
    thread_ts: threadTs,
    attachments,
  };
}

export async function extractPdfText(localPath: string): Promise<string> {
  try {
    const result = await execFileAsync("pdftotext", [localPath, "-"], { maxBuffer: 16 * 1024 * 1024 });
    return result.stdout;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
      try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = (pdfParseModule as unknown as {
          default?: (data: Buffer) => Promise<{ text?: string }>;
        }).default || (pdfParseModule as unknown as (data: Buffer) => Promise<{ text?: string }>);
        const parsed = await pdfParse(await readFile(localPath));
        return parsed.text || "";
      } catch {
        throw new Error("Slack: no usable PDF parser is installed on the AWS runtime");
      }
    }
    throw new Error("Slack: PDF extraction failed");
  }
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
          text: { type: "plain_text", text: "Approve + Draft" },
          style: "primary",
          action_id: "approve_send",
          value: JSON.stringify({ actionId: input.actionId, decision: "approve" }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "reject",
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
  const actionId = typeof action.action_id === "string" ? action.action_id : "";
  if (actionId !== "approve_send" && actionId !== "reject") return undefined;
  const value = typeof action.value === "string" ? action.value : "";
  try {
    const parsed = JSON.parse(value) as { actionId?: string; decision?: string };
    const decision = parseApprovalDecision(parsed.decision);
    if (parsed.actionId && decision && ((actionId === "approve_send" && decision === "approve") || (actionId === "reject" && decision === "reject"))) {
      return { actionId: parsed.actionId, decision };
    }
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
      if (!options.signingSecret || !validSlackSignature(rawBody, timestamp, signature, options.signingSecret)) {
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

export function createSlackSocketModeClient(options: SlackSocketModeOptions): SlackSocketModeClient {
  let app: App | undefined;

  return {
    connect: async () => {
      if (!options.appToken) {
        throw new Error("Slack: SLACK_APP_TOKEN is required for Socket Mode");
      }
      if (!options.botToken) {
        throw new Error("Slack: SLACK_BOT_TOKEN is required for Socket Mode");
      }
      if (options.judgeMode && process.env.GATEWAY_ALLOW_ALL_USERS?.toLowerCase() === "true") {
        throw new Error("Slack: GATEWAY_ALLOW_ALL_USERS is not allowed in JUDGE_MODE");
      }
      if (options.judgeMode && (!options.judgeChannelId || !options.judgeWorkspaceId || !options.allowedUserIds?.length)) {
        throw new Error("Slack: JUDGE_MODE requires a judge workspace, channel, and user allowlist");
      }

      app = new App({
        token: options.botToken,
        appToken: options.appToken,
        socketMode: true,
      });
      app.action("approve_send", async ({ ack, body }) => {
        await ack();
        if (!judgeContextAllowed(body, options)) {
          console.log("SLACK_JUDGE_ACTION_BLOCKED");
          return;
        }
        console.log("SLACK_APPROVE_RECEIVED");
        const decision = parseSlackInteraction(body);
        if (decision) await options.onDecision(decision);
      });
      app.action("reject", async ({ ack, body }) => {
        await ack();
        if (!judgeContextAllowed(body, options)) {
          console.log("SLACK_JUDGE_ACTION_BLOCKED");
          return;
        }
        console.log("SLACK_REJECT_RECEIVED");
        const decision = parseSlackInteraction(body);
        if (decision) await options.onDecision(decision);
      });
      if (options.onMessage) {
        app.event("app_mention", async ({ event, client }) => {
          try {
            assertJudgeContext(event, options);
            const message = await ingestSlackMessage(event as unknown as SlackInboundMessageEvent, {
              ...options.fileIngestion,
              botToken: options.botToken,
              fetchImpl: options.fetchImpl,
              judgeMode: options.judgeMode,
              judgeChannelId: options.judgeChannelId,
              judgeWorkspaceId: options.judgeWorkspaceId,
              allowedUserIds: options.allowedUserIds,
              getThreadMessages: async (channelId, threadTs) => {
                const replies = await client.conversations.replies({ channel: channelId, ts: threadTs });
                return Array.isArray(replies.messages) ? replies.messages as unknown[] : [];
              },
            });
            await options.onMessage(message);
          } catch (error) {
            console.error(error instanceof Error ? error.message : "Slack: inbound file ingestion failed");
          }
        });
      }
      await app.start();
      console.log("SLACK_SOCKET_CONNECTED");
    },
    close: async () => {
      if (app) await app.stop();
      app = undefined;
    },
  };
}

export async function postApproval(
  input: ApprovalMessageInput,
  options: SlackOptions = {},
): Promise<SlackPostResult> {
  const mode = options.mode || (options.botToken && options.channelId ? "live" : "mock");
  if (options.judgeMode) {
    if (mode !== "live") {
      throw new Error("Slack: JUDGE_MODE requires SLACK_MODE=live");
    }
    if (!options.judgeChannelId || options.channelId !== options.judgeChannelId) {
      throw new Error("Slack: JUDGE_MODE requires the dedicated judge channel");
    }
  }
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
