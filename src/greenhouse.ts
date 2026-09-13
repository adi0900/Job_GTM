export interface NormalizedJob {
  id: string;
  company: string;
  role: string;
  sourceUrl: string;
  description: string;
  postedAt?: string;
}

export interface GreenhouseJobRecord {
  id?: string | number;
  title?: string;
  absolute_url?: string;
  content?: string;
  updated_at?: string;
  created_at?: string;
  company?: { name?: string };
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface GreenhouseOptions {
  company?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

function cleanDescription(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeGreenhouseJob(
  raw: GreenhouseJobRecord,
  fallbackCompany = "Unknown company",
  boardToken = "jobs",
): NormalizedJob {
  const id = raw.id === undefined ? "" : String(raw.id);
  const role = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!id || !role) {
    throw new Error("Greenhouse: job is missing id or title");
  }

  const sourceUrl =
    typeof raw.absolute_url === "string" && raw.absolute_url.length > 0
      ? raw.absolute_url
      : "https://boards.greenhouse.io/" + encodeURIComponent(boardToken) + "/jobs/" + encodeURIComponent(id);

  const company =
    typeof raw.company?.name === "string" && raw.company.name.trim().length > 0
      ? raw.company.name.trim()
      : fallbackCompany;

  return {
    id,
    company,
    role,
    sourceUrl,
    description: cleanDescription(raw.content),
    postedAt: raw.updated_at || raw.created_at || undefined,
  };
}

export async function fetchGreenhouseJobs(
  boardToken: string,
  options: GreenhouseOptions = {},
): Promise<NormalizedJob[]> {
  if (!boardToken || boardToken.trim().length === 0) {
    throw new Error("Greenhouse: GREENHOUSE_BOARD_TOKEN is required");
  }

  const baseUrl = (options.baseUrl || "https://boards-api.greenhouse.io").replace(/\/$/, "");
  const url =
    baseUrl +
    "/v1/boards/" +
    encodeURIComponent(boardToken) +
    "/jobs?content=true";
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Greenhouse: request failed with HTTP " + response.status);
  }

  const payload = (await response.json()) as { jobs?: GreenhouseJobRecord[] };
  if (!Array.isArray(payload.jobs)) {
    throw new Error("Greenhouse: response did not contain a jobs array");
  }

  return payload.jobs.map((job) =>
    normalizeGreenhouseJob(job, options.company || "Unknown company", boardToken),
  );
}
