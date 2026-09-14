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

function finalOutput(): Record<string, unknown> {
  const state = getStrandsRunState();
  if (!state.jobs.length || !state.matches.length || !state.outreach) {
    throw new Error("Strands run did not complete greenhouse, matcher, and outreach tool use");
  }
  return {
    top_matches: state.matches,
    winner: state.matches[0],
    email: state.outreach,
  };
}

async function main(): Promise<void> {
  const resumeText = await readResume(process.argv.slice(2));
  resetStrandsRunState();
  console.log("orchestrator=strands-agents-sdk");
  console.log("strands_tools=" + STRANDS_TOOL_NAMES.join(","));
  console.log("STRANDS_AGENT_STARTED");

  await odyvaStrandsAgent.invoke(`This is Stage A analysis-only of a real two-stage Strands workflow. Complete live discovery and deterministic matching only. Do not call prepare_outreach in Stage A; Stage B will call it using the verified winner. Do not return until greenhouse_search and match_resume have completed.

Using the supplied resume evidence:

${resumeText}

1. call greenhouse_search with a limit of 5
2. call match_resume using the supplied resume evidence and the greenhouse jobs JSON
3. identify the top five deterministic matches
4. choose the strongest opportunity

Return an interim machine-readable JSON containing top_matches and winner.

Do not create a Gmail draft or append a Sheets record during this analysis. Human approval remains outside the Strands run.`);

  const stageAState = getStrandsRunState();
  if (!stageAState.jobs.length || !stageAState.matches.length || !stageAState.matches[0]) {
    throw new Error("Stage A did not complete greenhouse and matcher tool use");
  }

  const winner = stageAState.matches[0];
  await odyvaStrandsAgent.invoke(`This is Stage B of the real Strands workflow. Use the verified winning opportunity below and the supplied resume context.

Winning opportunity:
${JSON.stringify(winner)}

Resume context:
${resumeText}

Call prepare_outreach using this winning opportunity. You must use the tool and may not generate the email directly. You MUST call prepare_outreach for the selected winning opportunity before returning your final response. Do not write the outreach yourself.

Pass the winning opportunity's job_id and source_url in job_context, and pass the resume context in resume_context. Wait for prepare_outreach to return successfully. Do not create a Gmail draft or append a Sheets record; human approval remains outside the Strands run.

Return machine-readable JSON containing exactly these top-level fields:
top_matches, winner, email`);

  const state = getStrandsRunState();
  if (!state.outreach) {
    throw new Error("Stage B did not invoke prepare_outreach");
  }

  console.log("STRANDS_AGENT_COMPLETED");
  console.log(JSON.stringify(finalOutput(), null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
