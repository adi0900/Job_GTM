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
  const createdDrafts = new Map<string, EmailResult>();
  const sentDrafts = new Map<string, EmailResult>();

  function configuredMode(): EmailMode {
    const mode = options.mode || "dry_run";
    if (!["dry_run", "draft", "live"].includes(mode)) {
      throw new Error("Gmail: EMAIL_MODE must be dry_run, draft, or live");
    }
    return mode;
  }

  async function postGmail(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const fetchImpl = options.fetchImpl || fetch;
    const accessToken = await resolveAccessToken(options, fetchImpl);
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
        "Gmail: request failed" +
          (payload.error?.message ? ": " + payload.error.message : ""),
      );
    }
    return { id: payload.id };
  }

  return {
    async createDraft(input: EmailInput): Promise<EmailResult> {
      const mode = configuredMode();
      const previous = createdDrafts.get(input.actionId);
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
        createdDrafts.set(input.actionId, result);
        return result;
      }

      const payload = await postGmail(
        "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
        { message: { raw: rawMessage(input) } },
      );
      const result = {
        actionId: input.actionId,
        status: "draft" as const,
        externalId: payload.id as string,
      };
      createdDrafts.set(input.actionId, result);
      return result;
    },

    async sendDraft(draftId: string, actionId = "draft:" + draftId): Promise<EmailResult> {
      const mode = configuredMode();
      if (mode !== "live") {
        throw new Error("Gmail: draft sending requires GMAIL_MODE=live");
      }
      const previous = sentDrafts.get(draftId);
      if (previous) return previous;
      if (!draftId) {
        throw new Error("Gmail: draft id is required");
      }

      const payload = await postGmail(
        "https://gmail.googleapis.com/gmail/v1/users/me/drafts/send",
        { id: draftId },
      );
      const result = {
        actionId,
        status: "sent" as const,
        externalId: payload.id as string,
      };
      sentDrafts.set(draftId, result);
      return result;
    },

    async sendApprovedEmail(input: EmailInput): Promise<EmailResult> {
      const mode = configuredMode();
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

      const endpoint =
        mode === "draft"
          ? "https://gmail.googleapis.com/gmail/v1/users/me/drafts"
          : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
      const body =
        mode === "draft"
          ? { message: { raw: rawMessage(input) } }
          : { raw: rawMessage(input) };
      const payload = await postGmail(endpoint, body);
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
