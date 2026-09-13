import { createSheetsClient } from "../src/sheets.ts";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const sheets = createSheetsClient({
    mode: "live",
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: process.env.GOOGLE_SHEETS_RANGE,
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  });
  await sheets.appendResultRow({
    timestamp: new Date().toISOString(),
    company: argument("--company"),
    role: argument("--role"),
    sourceUrl: argument("--source-url"),
    matchScore: Number(argument("--match-score")),
    decision: argument("--decision"),
    emailStatus: argument("--email-status"),
  });
  process.stdout.write(JSON.stringify({ ok: true }) + "\n");
}

main().catch((error: unknown) => {
  process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exitCode = 1;
});
