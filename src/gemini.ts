import type { NormalizedJob } from "./greenhouse.ts";
import type { CapabilityProfile, OpportunityMatch } from "./matcher.ts";

export interface OutreachDraft {
  likelyPain: string;
  whyFit: string;
  recipientRole?: string;
  subject: string;
  body: string;
  evidenceUsed: string[];
}

export type GeminiMode = "live" | "mock";

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  mode?: GeminiMode;
  baseUrl?: string;
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

function mockOutreach(
  job: NormalizedJob,
  match: OpportunityMatch,
): OutreachDraft {
  const capabilities =
    match.matchedCapabilities.length > 0
      ? match.matchedCapabilities.join(", ")
      : "the listed GTM and automation requirements";
  return {
    likelyPain:
      "The open " +
      job.role +
      " role suggests the company is actively building or repairing repeatable growth operations.",
    whyFit:
      "The job has a " +
      match.score +
      "% explainable match because it overlaps with verified capabilities in " +
      capabilities +
      ".",
    recipientRole: "Hiring owner",
    subject: "A thought on the " + job.role + " search",
    body:
      "Hi there. I noticed the open " +
      job.role +
      " role at " +
      job.company +
      ". The role overlaps with verified capabilities in " +
      capabilities +
      ". Would a short conversation about the current growth workflow be useful?",
    evidenceUsed: match.matchedCapabilities,
  };
}

function promptFor(
  job: NormalizedJob,
  profile: CapabilityProfile,
  match: OpportunityMatch,
): string {
  return [
    "You are preparing grounded B2B outreach for Odyva GTM.",
    "Use only facts present in the job and capability profile.",
    "Do not invent employers, customers, results, case studies, metrics, or credentials.",
    "Return JSON with likelyPain, whyFit, recipientRole, subject, body, and evidenceUsed.",
    "The email body must be 3 to 5 sentences and reference the live role, likely operational pain, one verified capability, and a clear call to action.",
    "Job: " + JSON.stringify(job),
    "Capability profile: " + JSON.stringify(profile),
    "Deterministic match: " + JSON.stringify(match),
  ].join("\n\n");
}

function parseModelText(text: string): unknown {
  const marker = String.fromCharCode(96).repeat(3);
  const start = text.indexOf(marker);
  const end = start < 0 ? -1 : text.indexOf(marker, start + marker.length);
  const candidate =
    start >= 0 && end > start
      ? text.slice(start + marker.length, end).replace(/^json\s*/i, "")
      : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    throw new Error("Gemini: response was not valid JSON");
  }
}

function validateDraft(value: unknown): OutreachDraft {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini: response was not an object");
  }
  const record = value as Record<string, unknown>;
  const stringFields = ["likelyPain", "whyFit", "subject", "body"];
  for (const field of stringFields) {
    if (typeof record[field] !== "string" || String(record[field]).trim().length === 0) {
      throw new Error("Gemini: response is missing " + field);
    }
  }
  if (!Array.isArray(record.evidenceUsed) || record.evidenceUsed.some((item) => typeof item !== "string")) {
    throw new Error("Gemini: evidenceUsed must be a string array");
  }
  const body = String(record.body);
  const sentenceCount = body.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  if (sentenceCount < 3 || sentenceCount > 6) {
    throw new Error("Gemini: outreach body must contain 3 to 5 sentences");
  }
  return {
    likelyPain: String(record.likelyPain),
    whyFit: String(record.whyFit),
    recipientRole: typeof record.recipientRole === "string" ? record.recipientRole : undefined,
    subject: String(record.subject),
    body,
    evidenceUsed: record.evidenceUsed as string[],
  };
}

export async function generateOutreach(
  job: NormalizedJob,
  profile: CapabilityProfile,
  match: OpportunityMatch,
  options: GeminiOptions = {},
): Promise<OutreachDraft> {
  const mode = options.mode || (options.apiKey ? "live" : "mock");
  if (mode === "mock") {
    return mockOutreach(job, match);
  }
  if (!options.apiKey) {
    throw new Error("Gemini: GEMINI_API_KEY is required in live mode");
  }

  const model = options.model || "gemini-2.5-flash";
  const baseUrl = (options.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const endpoint = baseUrl + "/models/" + encodeURIComponent(model) + ":generateContent";
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": options.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptFor(job, profile, match) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            likelyPain: { type: "STRING" },
            whyFit: { type: "STRING" },
            recipientRole: { type: "STRING" },
            subject: { type: "STRING" },
            body: { type: "STRING" },
            evidenceUsed: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["likelyPain", "whyFit", "subject", "body", "evidenceUsed"],
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Gemini: request failed with HTTP " + response.status);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!text) {
    throw new Error("Gemini: response contained no candidate text");
  }
  return validateDraft(parseModelText(text));
}
