export interface SheetRow {
  timestamp: string;
  company: string;
  role: string;
  sourceUrl: string;
  matchScore: number;
  decision: string;
  emailStatus: string;
}

export interface SheetsOptions {
  spreadsheetId?: string;
  judgeMode?: boolean;
  judgeSpreadsheetId?: string;
  range?: string;
  mode?: "live" | "mock";
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

export interface SheetsAppendResult {
  status: "recorded" | "mock";
  range?: string;
}

async function resolveAccessToken(
  options: SheetsOptions,
  fetchImpl: (input: string | URL, init?: RequestInit) => Promise<Response>,
): Promise<string> {
  if (options.accessToken) return options.accessToken;
  if (!options.clientId || !options.clientSecret || !options.refreshToken) {
    throw new Error("Google Sheets: access token or OAuth client and refresh token are required");
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
    throw new Error(
      "Google Sheets: OAuth refresh failed" + (payload.error ? ": " + payload.error : ""),
    );
  }
  return payload.access_token;
}

export function createSheetsClient(options: SheetsOptions = {}) {
  return {
    async appendResultRow(row: SheetRow): Promise<SheetsAppendResult> {
      const mode = options.mode || (options.spreadsheetId ? "live" : "mock");
      if (options.judgeMode && mode !== "live") {
        throw new Error("Google Sheets: JUDGE_MODE requires SHEETS_MODE=live");
      }
      if (options.judgeMode && (!options.judgeSpreadsheetId || options.spreadsheetId !== options.judgeSpreadsheetId)) {
        throw new Error("Google Sheets: JUDGE_MODE requires the dedicated judge spreadsheet");
      }
      if (mode === "mock") {
        return { status: "mock" };
      }
      if (!options.spreadsheetId) {
        throw new Error("Google Sheets: GOOGLE_SHEETS_SPREADSHEET_ID is required in live mode");
      }

      const fetchImpl = options.fetchImpl || fetch;
      const accessToken = await resolveAccessToken(options, fetchImpl);
      const range = options.range || "Sheet1!A:G";
      const endpoint =
        "https://sheets.googleapis.com/v4/spreadsheets/" +
        encodeURIComponent(options.spreadsheetId) +
        "/values/" +
        encodeURIComponent(range) +
        ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: "Bearer " + accessToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          majorDimension: "ROWS",
          values: [[
            row.timestamp,
            row.company,
            row.role,
            row.sourceUrl,
            row.matchScore,
            row.decision,
            row.emailStatus,
          ]],
        }),
      });
      const payload = (await response.json()) as {
        updates?: { updatedRange?: string };
        error?: { message?: string };
      };
      if (!response.ok || !payload.updates) {
        throw new Error(
          "Google Sheets: append failed" +
            (payload.error?.message ? ": " + payload.error.message : ""),
        );
      }
      return { status: "recorded", range: payload.updates.updatedRange };
    },
  };
}
