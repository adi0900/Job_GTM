import { createGmailClient } from "../src/gmail.ts";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const gmail = createGmailClient({
    mode: "draft",
    accessToken: process.env.GMAIL_ACCESS_TOKEN,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  });
  const result = await gmail.sendApprovedEmail({
    actionId: `odyva-cli-${Date.now()}`,
    to: argument("--to"),
    subject: argument("--subject"),
    body: argument("--body"),
  });
  process.stdout.write(JSON.stringify({ ok: true, draft_id: result.externalId }) + "\n");
}

main().catch((error: unknown) => {
  process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exitCode = 1;
});
