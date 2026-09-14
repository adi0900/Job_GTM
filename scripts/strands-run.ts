import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { extname } from "node:path";
import { extractPdfText } from "../src/slack.ts";
import {
  getStrandsRunState,
  odyvaStrandsAgent,
  resetStrandsRunState,
  STRANDS_TOOL_NAMES,
} from "../src/strands-agent.ts";

function argumentValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readResume(args: string[]): Promise<string> {
  const directText = argumentValue(args, "--resume-text");
  if (directText) return directText;

  const source = argumentValue(args, "--resume");
  if (!source) {
    throw new Error("Usage: node --experimental-strip-types scripts/strands-run.ts --resume <path> or --resume-text <text>");
  }

  try {
    await access(source, constants.R_OK);
  } catch {
    return source;
  }

  if (extname(source).toLowerCase() === ".pdf") {
    return extractPdfText(source);
  }
  return readFile(source, "utf8");
}

function parseAgentJson(text: string): Record<string, unknown> | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function finalOutput(agentText: string): Record<string, unknown> {
  const state = getStrandsRunState();
  const modelOutput = parseAgentJson(agentText);
  const topMatches = Array.isArray(modelOutput?.top_matches)
    ? modelOutput.top_matches
    : state.matches;
  const winner = modelOutput?.winner && typeof modelOutput.winner === "object"
    ? modelOutput.winner
    : state.matches[0];
  const email = modelOutput?.email && typeof modelOutput.email === "object"
    ? modelOutput.email
    : state.outreach;
  if (!state.jobs.length || !state.matches.length || !state.outreach || !winner || !email) {
    throw new Error("Strands run did not complete greenhouse, matcher, and outreach tool use");
  }
  return {
    top_matches: topMatches,
    winner,
    email,
  };
}

async function main(): Promise<void> {
  const resumeText = await readResume(process.argv.slice(2));
  resetStrandsRunState();
  console.log("orchestrator=strands-agents-sdk");
  console.log("strands_tools=" + STRANDS_TOOL_NAMES.join(","));
  console.log("STRANDS_AGENT_STARTED");

  const result = await odyvaStrandsAgent.invoke(`Using the supplied resume evidence:

${resumeText}

1. call greenhouse_search with a limit of 5
2. call match_resume using the supplied resume evidence and the greenhouse jobs JSON
3. identify the top five deterministic matches
4. choose the strongest opportunity
5. call prepare_outreach for the strongest opportunity

Return machine-readable JSON containing exactly these top-level fields:
top_matches, winner, email

Do not create a Gmail draft or append a Sheets record during this analysis. Human approval remains outside the Strands run.`);

  console.log("STRANDS_AGENT_COMPLETED");
  console.log(JSON.stringify(finalOutput(result.toString()), null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
