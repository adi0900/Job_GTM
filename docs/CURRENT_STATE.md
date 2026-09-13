# CURRENT_STATE.md

## Audit

Repository audit completed on 2026-09-13 before implementation changes. The repository is a Git project on branch master with origin set to the Job_GTM GitHub repository.

## Stack

~~~text
language: TypeScript
runtime: Node.js v22.20.0
package manager: npm 10.9.3
framework: none
database/storage: local JSON files
dependencies: none
~~~

The TypeScript files run directly through Node's strip-only TypeScript support. No third-party dependency installation was required.

## Commands

~~~text
install: npm install
run: npm run demo
test: npm test
syntax check: npm run check
build: not configured
lint: not configured
~~~

The demo requires environment configuration. Safe local mode uses a Greenhouse board token, mock Gemini and Slack modes, Slack approval supplied through the environment, Gmail dry-run mode, and mock Sheets mode.

## Repository layout

The repository contains:

- src/index.ts
- src/greenhouse.ts
- src/matcher.ts
- src/hermes.ts
- src/gemini.ts
- src/slack.ts
- src/gmail.ts
- src/sheets.ts
- src/storage.ts
- scripts/gmail-draft.ts
- scripts/gmail-send.ts
- data/capability_profile.json
- data/results.json
- tests/flow.test.ts
- .env.example
- package.json
- tsconfig.json
- four core documents in docs/

The capability profile now contains only information supplied in the project documentation. Results storage starts as an empty JSON array.

## Working functionality

- Greenhouse fetches the public Job Board API and normalizes job id, company, role, source URL, description, and updated timestamp.
- A live read-only request to the public GuidePoint Security board returned 56 jobs.
- The matcher calculates capability fit, intent, evidence, urgency, overall score, matched capabilities, and reasons deterministically.
- Gemini has a live REST adapter with structured JSON response validation and a grounded local mock mode.
- Slack has a live chat.postMessage adapter, Block Kit approval card, and interaction payload parser.
- Gmail supports dry_run, draft, and live modes with approval-gated draft creation, Gmail `drafts.send`, and process-level idempotency guards.
- Google Sheets has a live values.append adapter and a local mock mode.
- JSON storage can load and upsert flow results.
- Hermes coordinates the flow, prepares a Gmail draft before approval, and blocks Gmail sending until approval.
- The complete local-safe flow was run against live Greenhouse data with mock Gemini, mock Slack, Gmail dry-run, and mock Sheets.

## Partial functionality

- Slack approval cards can be posted, and block action payloads can be parsed, but a public callback server is not yet wired into the demo command.
- Gemini live calls are implemented but have not been verified because no API key is configured.
- Gmail OAuth and real draft creation are verified; the approval-gated live send path is implemented and still requires the single explicit send test.
- Google Sheets live append is implemented but has not been verified because no spreadsheet or OAuth credentials are configured.
- Local persistence is implemented, but the live demo run used a temporary result path and did not write a repository result.

## Missing functionality

- Slack interaction callback delivery into a running flow
- configured Gemini API credentials and live verification
- approval-gated Gmail live send verification
- configured Google Sheets OAuth and append verification
- a saved real fallback job for recording
- README setup and reliability sections updated with final command evidence
- end-to-end tests against authenticated external apps

## Current end-to-end flow

~~~text
live Greenhouse job
→ normalized job
→ deterministic capability match and score
→ Hermes orchestration
→ grounded mock or live Gemini draft
→ Slack mock card or live approval card
→ environment-supplied approval
→ Gmail draft
→ explicit approval
→ Gmail `drafts.send`
→ Sheets mock or live row
→ local JSON result
~~~

The local-safe path is verified. The live multi-app path is waiting on credentials and Slack callback delivery.

## External apps verified

~~~text
greenhouse: live public fetch verified against GuidePoint Security; 56 jobs returned
slack: mock card path and block action parser tested; live post not authenticated
gmail: OAuth and real draft creation verified; approval-gated `drafts.send` path added; live send proof pending
google sheets: mock append and failure handling tested; live append not authenticated
gemini: mock generation and validation tested; live provider not authenticated
hermes: local orchestration and approval gate tested
~~~

## Tests

~~~text
test command: npm test
passing: 15
failing: 0
syntax check: npm run check passed
manual verification: live Greenhouse fetch plus complete local-safe approved dry-run
~~~

Reliability cases covered by tests:

- happy path
- reject path
- duplicate approval
- Gemini failure
- Gmail failure
- Google Sheets failure
- Greenhouse normalization and fetch
- Gemini mock grounding
- Slack approval payload parsing
- Gmail dry-run idempotency

## Known blockers

- No API keys, OAuth tokens, spreadsheet id, Slack bot token, or public Slack interaction URL are present in the repository.
- Live Slack approval requires an externally reachable request URL for Block Kit interaction payloads.
- The remaining Gmail-specific verification is one explicit approved live send; no credentials are stored in the repository.

## Next step

Add the minimal Slack interaction callback server or an equivalent approval handoff, then verify authenticated Slack, Gmail, Google Sheets, and Gemini paths as credentials become available.
