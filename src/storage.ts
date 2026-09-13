import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface StoredResult {
  actionId: string;
  decision: string;
  emailStatus: string;
  sheetStatus: string;
  status: string;
  [key: string]: unknown;
}

export function createActionId(company: string, role: string, subject: string, body: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ company, role, subject, body }))
    .digest("hex")
    .slice(0, 24);
}

export async function loadResults(filePath = "data/results.json"): Promise<StoredResult[]> {
  let raw = "";
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }
  if (raw.trim().length === 0) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Storage: results file must contain an array");
  }
  return parsed as StoredResult[];
}

export async function getResult(
  actionId: string,
  filePath = "data/results.json",
): Promise<StoredResult | undefined> {
  const results = await loadResults(filePath);
  return results.find((result) => result.actionId === actionId);
}

export async function saveResult(
  result: StoredResult,
  filePath = "data/results.json",
): Promise<void> {
  const results = await loadResults(filePath);
  const index = results.findIndex((item) => item.actionId === result.actionId);
  if (index >= 0) {
    results[index] = result;
  } else {
    results.push(result);
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(results, null, 2) + "\n", "utf8");
}
