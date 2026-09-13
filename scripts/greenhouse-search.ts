import { fetchGreenhouseJobs } from "../src/greenhouse.ts";

function limit(): number {
  const index = process.argv.indexOf("--limit");
  if (index < 0) return 10;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) throw new Error("--limit must be a positive integer");
  return value;
}

async function main(): Promise<void> {
  const jobs = await fetchGreenhouseJobs(process.env.GREENHOUSE_BOARD_TOKEN || "", {
    company: process.env.GREENHOUSE_COMPANY,
  });
  process.stdout.write(JSON.stringify({ ok: true, jobs: jobs.slice(0, limit()), total: jobs.length }) + "\n");
}

main().catch((error: unknown) => {
  process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exitCode = 1;
});
