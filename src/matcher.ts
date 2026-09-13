import type { NormalizedJob } from "./greenhouse.ts";

export interface CapabilityProfile {
  name?: string;
  positioning?: string;
  skills?: string[];
  technologies?: string[];
  experience?: unknown[];
  results?: unknown[];
  case_studies?: unknown[];
  constraints?: unknown[];
}

export interface OpportunityMatch {
  score: number;
  capabilityFit: number;
  intent: number;
  evidence: number;
  urgency: number;
  reasons: string[];
  matchedCapabilities: string[];
}

const aliases: Record<string, string[]> = {
  "ai automation": ["ai automation", "automation", "workflow automation"],
  "gtm systems": ["gtm systems", "go-to-market", "go to market", "growth systems"],
  "workflow design": ["workflow design", "workflow", "workflows"],
  typescript: ["typescript", "type script"],
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasTerm(text: string, term: string): boolean {
  const haystack = normalized(text);
  const variants = aliases[normalized(term)] || [term];
  return variants.some((variant) => haystack.includes(normalized(variant)));
}

function round(value: number): number {
  return Math.round(value);
}

function intentFromPostedAt(postedAt: string | undefined, now: Date): number {
  if (!postedAt) {
    return 50;
  }
  const posted = Date.parse(postedAt);
  if (Number.isNaN(posted)) {
    return 50;
  }
  const ageHours = Math.max(0, (now.getTime() - posted) / 3600000);
  if (ageHours <= 24) return 100;
  if (ageHours <= 24 * 7) return 80;
  if (ageHours <= 24 * 30) return 60;
  return 40;
}

function urgencyFromJob(job: NormalizedJob, intent: number): { score: number; signal: boolean } {
  const text = normalized(job.role + " " + job.description);
  const signal = ["urgent", "asap", "immediately", "founding", "first hire", "build from scratch"].some(
    (term) => text.includes(normalized(term)),
  );
  return {
    score: Math.min(100, round(intent * 0.6 + (signal ? 40 : 20))),
    signal,
  };
}

export function matchOpportunity(
  job: NormalizedJob,
  profile: CapabilityProfile,
  now = new Date(),
): OpportunityMatch {
  const capabilities = Array.from(
    new Set([...(profile.skills || []), ...(profile.technologies || [])].filter(Boolean)),
  );
  const jobText = job.role + " " + job.description;
  const matchedCapabilities = capabilities.filter((capability) => hasTerm(jobText, capability));
  const capabilityFit =
    capabilities.length === 0 ? 0 : round((matchedCapabilities.length / capabilities.length) * 100);
  const intent = intentFromPostedAt(job.postedAt, now);
  const evidence =
    matchedCapabilities.length === 0
      ? 0
      : Math.min(100, 50 + round((matchedCapabilities.length / Math.max(1, capabilities.length)) * 50));
  const urgencyResult = urgencyFromJob(job, intent);
  const score = round(
    capabilityFit * 0.4 + intent * 0.3 + evidence * 0.2 + urgencyResult.score * 0.1,
  );

  const reasons: string[] = [];
  if (matchedCapabilities.length > 0) {
    reasons.push("verified capability overlap: " + matchedCapabilities.join(", "));
    reasons.push("job requirements map to capabilities listed in the profile");
  } else {
    reasons.push("no direct verified capability overlap found");
  }
  if (intent >= 80) {
    reasons.push("recent hiring activity increases live intent");
  } else if (!job.postedAt) {
    reasons.push("posted time is unavailable, so intent is scored conservatively");
  } else {
    reasons.push("older posting lowers current intent");
  }
  if (urgencyResult.signal) {
    reasons.push("job language signals urgency");
  } else {
    reasons.push("the open role is treated as a current operational signal");
  }

  return {
    score,
    capabilityFit,
    intent,
    evidence,
    urgency: urgencyResult.score,
    reasons,
    matchedCapabilities,
  };
}
