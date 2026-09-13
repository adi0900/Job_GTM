# AGENTS.md

# Odyva GTM Hackathon Agent Instructions

## Mission

Build the smallest complete, judge-ready Odyva GTM demo for the Multi-App AI Agent Hackathon.

The project must prove one useful multi-step AI agent that takes action across at least three external apps.

For this project, the required external apps are:

1. Greenhouse
2. Slack
3. Gmail
4. Google Sheets

Gemini API is the primary AI model provider.
Hermes is the runtime operator.

Sol and Luna are development-only and must not appear as production agents.

---

## Hackathon Success Condition

The MVP is complete only when one real opportunity can travel through this full loop:

```text
Greenhouse job discovered
→ normalized
→ matched against capability profile
→ scored
→ Hermes coordinates reasoning
→ Gemini generates grounded outreach
→ Slack approval card appears
→ human approves or rejects
→ Gmail executes only after approval
→ Google Sheets records the result
```

The judges should be able to see the complete loop in under two minutes.

---

## Product

Odyva GTM is a 24/7 AI-powered GTM search and conversion system.

It continuously looks for companies showing live operational intent, matches those opportunities against a verified capability profile, prepares the strongest next action, asks for human approval in Slack, executes approved outreach through Gmail, and writes the result to Google Sheets.

The hackathon demo should prove:

```text
we know what you can actually do
+
we find who needs it now
+
we explain why the match is strong
+
we prepare the action
+
you approve
+
the system executes
+
the result is recorded
```

---

## Runtime Roles

### Hermes

Hermes is the production operator.

For the hackathon, Hermes coordinates:

- live opportunity discovery
- capability matching
- action preparation
- approval flow
- execution flow
- result recording

Do not build a large agent framework.

Keep Hermes thin and understandable.

Recommended tool surface:

```text
getLiveJobs()
matchOpportunity()
generateOutreach()
requestApproval()
sendApprovedEmail()
recordResult()
```

Hermes must not directly contain raw Gmail, Slack, Greenhouse, or Google Sheets SDK logic.

---

### Gemini API

Gemini is the primary AI caller.

Use Gemini for:

- job pain extraction
- requirement extraction
- capability overlap reasoning
- concise opportunity explanation
- personalized outbound generation

Gemini should not invent experience, customers, results, case studies, or proof.

Gemini should not directly perform external actions.

Keep Gemini access in one provider/module.

---

### AWS

AWS is the intended hosting layer.

For the hackathon, do not build a distributed AWS architecture unless it already exists.

Local-first is acceptable.

Do not spend hackathon time on:

- SQS
- EventBridge
- ECS service decomposition
- dead-letter queues
- distributed tracing
- autoscaling
- multi-region infrastructure

unless those pieces already exist and require almost no additional work.

---

### Sol + Luna

Sol and Luna are development-only.

They may help with:

- coding
- debugging
- testing
- architecture

They must not appear in the production runtime flow.

---

## Required External Apps

The project must visibly use these four external apps:

### 1. Greenhouse

Purpose:

```text
live intent discovery
```

Required demo behavior:

```text
fetch at least one real job opportunity
```

---

### 2. Slack

Purpose:

```text
human approval
```

Required demo behavior:

```text
show opportunity
show score
show reasons
show generated email
allow approve
allow reject
```

---

### 3. Gmail

Purpose:

```text
approved outbound execution
```

Required demo behavior:

```text
send, draft, or dry-run only after approval
```

Recommended development default:

```env
EMAIL_MODE=dry_run
```

---

### 4. Google Sheets

Purpose:

```text
persistent external record of the action
```

Required demo behavior:

after approval/execution, append a row containing at minimum:

```text
company
role
match score
decision
email status
timestamp
```

Google Sheets is mandatory for the hackathon submission.

It is not a nice-to-have.

---

## Required README Structure

Before submission, `README.md` must contain these exact top-level judge sections:

```text
## 01. Project Overview
## 02. External Apps Used
## 03. Setup Instructions
## 04. Reliability Testing
## 05. Demo Video
```

Do not hide these sections below architecture details.

Judges should be able to verify every requirement immediately.

---

## Required Demo Flow

The primary demo flow is:

```text
Greenhouse
→ normalize job
→ capability profile match
→ deterministic score
→ Hermes
→ Gemini
→ Slack approval
→ Gmail
→ Google Sheets
```

---

## Capability Profile

Use structured JSON as the source of truth.

Example:

```json
{
  "name": "candidate",
  "positioning": "AI creative director and GTM operator",
  "skills": [
    "AI automation",
    "GTM systems",
    "workflow design",
    "TypeScript"
  ],
  "technologies": [],
  "experience": [],
  "results": [],
  "case_studies": [],
  "constraints": []
}
```

The ATS-friendly resume can later be generated from the same profile.

For the hackathon, do not repeatedly parse a PDF if JSON already exists.

Never invent capability evidence.

---

## Opportunity Model

Keep it simple.

```ts
type Opportunity = {
  company: string
  role: string
  sourceUrl: string
  description: string
  postedAt?: string
}
```

Match output:

```ts
type OpportunityMatch = {
  score: number
  capabilityFit: number
  intent: number
  evidence: number
  urgency: number
  reasons: string[]
}
```

---

## Scoring

Use explainable scoring.

Suggested MVP formula:

```text
score =
  capabilityFit * 0.40 +
  intent        * 0.30 +
  evidence      * 0.20 +
  urgency       * 0.10
```

Gemini may help extract or classify inputs.

Gemini should not simply invent the final score.

A judge should be able to understand why an opportunity scored highly.

---

## Slack Approval

The Slack card should include:

```text
company
role
match score
why it matches
generated outreach

[ Approve + Send ]
[ Reject ]
```

The approval decision must control Gmail execution.

Reject must produce zero outbound email.

---

## Gmail Safety

Supported modes:

```text
dry_run
draft
live
```

Default:

```env
EMAIL_MODE=dry_run
```

Do not enable live sending until the full flow is verified.

A duplicate approval must not produce two sends.

---

## Google Sheets Logging

After the final decision, append a row.

Suggested columns:

```text
timestamp
company
role
source_url
match_score
decision
email_status
```

If Google Sheets fails, surface the error clearly.

Do not silently claim the run completed successfully.

---

## Storage

Internal storage can remain simple.

Allowed:

- JSON
- SQLite
- existing Postgres

Do not introduce a new database only for architectural purity.

External Google Sheets recording is still required.

---

## Reliability Testing

Reliability is a major judging category.

Before submission, verify at least these flows:

### Test 1: Happy Path

```text
job
→ match
→ generate
→ approve
→ Gmail execution
→ Google Sheets row
```

Expected:

```text
one email action
one sheet row
successful final status
```

### Test 2: Reject Path

```text
job
→ match
→ generate
→ reject
```

Expected:

```text
zero Gmail sends
decision recorded in Google Sheets
```

### Test 3: Duplicate Approval

```text
same action approved twice
```

Expected:

```text
only one Gmail action
```

### Test 4: Gemini Failure

Expected:

```text
clean failure
no email
no fake success state
```

### Test 5: Gmail Failure

Expected:

```text
error surfaced
sheet reflects failed execution or failure is logged clearly
no duplicate retry side effect
```

### Test 6: Google Sheets Failure

Expected:

```text
execution status remains accurate
failure is surfaced
no false "complete" state
```

---

## Test Evidence

Before submission, update README with real test evidence.

Do not write fake counts.

Include:

```text
test command:
actual passing count:
actual failing count:
manual verification:
```

If there are only a few tests, that is acceptable.

Truthful verification is better than inflated claims.

---

## Setup Instructions Requirement

Before submission, README setup instructions must contain actual commands from the repository.

Do not invent:

```text
npm run dev
pnpm dev
npm test
```

unless they exist.

The coding agent must inspect `package.json` and update README with real commands.

Also document all required environment variables.

---

## Demo Video Requirement

Before submission, README must include:

```text
## 05. Demo Video
```

with a real accessible video URL.

Maximum duration:

```text
2 minutes
```

Do not submit with a placeholder link.

---

## Recommended Repo Shape

```text
odyva-gtm/
├── AGENTS.md
├── README.md
├── docs/
│   ├── VISION.md
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   └── DEMO_FLOW.md
├── src/
│   ├── index.ts
│   ├── greenhouse.ts
│   ├── matcher.ts
│   ├── hermes.ts
│   ├── gemini.ts
│   ├── slack.ts
│   ├── gmail.ts
│   ├── sheets.ts
│   └── storage.ts
├── data/
│   ├── capability_profile.json
│   └── results.json
├── tests/
│   └── flow.test.ts
├── .env.example
├── package.json
└── tsconfig.json
```

Do not create extra abstractions unless required by the actual code.

---

## Development Safety

Use safe defaults:

```env
APP_ENV=development
EMAIL_MODE=dry_run
```

Rules:

- never commit secrets
- never print secrets
- never send email without approval
- never invent capability evidence
- never silently swallow external app failure
- never let duplicate approval create duplicate sends

---

## Build Order

Use this order:

```text
1. inspect real repo
2. verify actual run command
3. capability profile
4. Greenhouse fetch
5. normalize job
6. deterministic match score
7. Gemini generation
8. Hermes orchestration
9. Slack approval
10. Gmail execution
11. Google Sheets row
12. happy-path test
13. reject-path test
14. duplicate-send test
15. failure handling
16. README completion
17. record demo video
```

---

## Submission Gate

Do not consider the project complete until all of these are true:

```text
[ ] GitHub repo is accessible
[ ] Greenhouse works
[ ] Slack works
[ ] Gmail works
[ ] Google Sheets works
[ ] happy path works
[ ] reject path works
[ ] duplicate-send protection works
[ ] README 01-05 sections are complete
[ ] setup instructions are real
[ ] reliability evidence is real
[ ] demo video link is real
[ ] video is under 2 minutes
[ ] no secrets are committed
```

---

## Primary Rule

```text
working multi-app demo
>
perfect architecture
```
