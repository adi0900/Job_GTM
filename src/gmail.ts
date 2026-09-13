export type EmailMode = "dry_run" | "draft" | "live";

export interface EmailInput {
  actionId: string;
  to: string;
  subject: string;
  body: string;
}

export interface EmailResult {
  actionId: string;
  status: "dry_run" | "draft" | "sent";
  externalId: string;
}

export interface GmailOptions {
  mode?: EmailMode;
  judgeMode?: boolean;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

function headerSafe(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function resolveAccessToken(
  options: GmailOptions,
  fetchImpl: (input: string | URL, init?: RequestInit) => Promise<Response>,
): Promise<string> {
  if (options.accessToken) return options.accessToken;
  if (!options.clientId || !options.clientSecret || !options.refreshToken) {
    throw new Error("Gmail: access token or OAuth client and refresh token are required");
  }
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: options.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error("Gmail: OAuth refresh failed" + (payload.error ? ": " + payload.error : ""));
  }
  return payload.access_token;
}

function rawMessage(input: EmailInput): string {
  return encodeBase64Url(
    "To: " +
      headerSafe(input.to) +
      "\r\nSubject: " +
      headerSafe(input.subject) +
      "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" +
      input.body,
  );
}

export function createGmailClient(options: GmailOptions = {}) {
  const executed = new Map<string, EmailResult>();
  return {
    async sendApprovedEmail(input: EmailInput): Promise<EmailResult> {
      const mode = options.mode || "dry_run";
      if (!["dry_run", "draft", "live"].includes(mode)) {
        throw new Error("Gmail: EMAIL_MODE must be dry_run, draft, or live");
      }
      if (options.judgeMode && mode !== "draft") {
        throw new Error("Gmail: JUDGE_MODE requires EMAIL_MODE=draft");
      }
      const previous = executed.get(input.actionId);
      if (previous) return previous;
      if (!input.to) {
        throw new Error("Gmail: recipient is required");
      }

      if (mode === "dry_run") {
        const result = {
          actionId: input.actionId,
          status: "dry_run" as const,
          externalId: "dry-run:" + input.actionId,
        };
        executed.set(input.actionId, result);
        return result;
      }

      const fetchImpl = options.fetchImpl || fetch;
      const accessToken = await resolveAccessToken(options, fetchImpl);
      const endpoint =
        mode === "draft"
          ? "https://gmail.googleapis.com/gmail/v1/users/me/drafts"
          : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
      const body =
        mode === "draft"
          ? { message: { raw: rawMessage(input) } }
          : { raw: rawMessage(input) };
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: "Bearer " + accessToken,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { id?: string; error?: { message?: string } };
      if (!response.ok || !payload.id) {
        throw new Error(
          "Gmail: " +
            mode +
            " failed" +
            (payload.error?.message ? ": " + payload.error.message : ""),
        );
      }
      const result = {
        actionId: input.actionId,
        status: mode === "draft" ? ("draft" as const) : ("sent" as const),
        externalId: payload.id,
      };
      executed.set(input.actionId, result);
      return result;
    },
  };
}
