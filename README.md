# Odyva GTM

Odyva GTM is a 24/7 AI-powered GTM search and conversion system.

It finds companies showing live operational intent, matches those opportunities against a verified capability profile, explains why the match is strong, prepares personalized outreach, routes the action through Slack approval, and then executes through Gmail.

This repository is the hackathon MVP.

The goal is not to build the final production platform.

The goal is to prove the complete product loop.

---

## Demo Thesis

Most GTM tools automate isolated tasks.

Odyva connects the full loop:

```text
live intent
→ capability match
→ opportunity score
→ AI reasoning
→ human approval
→ execution
→ result
```

The demo should answer one simple question:

```text
who needs what we can do right now,
and what is the best action to convert them?
```

---

## Core Demo

Example:

```text
1. Odyva discovers a Greenhouse role posted recently.

2. It extracts the company's active hiring problem.

3. It compares the role against the capability profile.

4. It calculates a match score.

5. Hermes coordinates the reasoning flow.

6. Gemini generates:
   - why this is a strong match
   - the likely pain
   - a short personalized email

7. Slack displays the opportunity.

8. The user clicks Approve.

9. Gmail sends or dry-runs the email.

10. The result is saved.
```

The ideal demo moment:

```text
role posted 11 hours ago

92% capability match

why:
- active growth systems hiring
- matching automation experience
- relevant technical overlap
- immediate hiring intent

[ approve + send ]
```

---

## Runtime

```text
Greenhouse
   ↓
Odyva
   ↓
Hermes
   ↓
Gemini API
   ↓
Slack approval
   ↓
Gmail
   ↓
Saved result
```

### Hermes

Hermes is the runtime operator.

It coordinates the workflow and calls a small set of domain tools.

### Gemini API

Gemini is the main AI caller.

It handles:

- job pain extraction
- context reasoning
- capability matching support
- opportunity explanation
- outreach generation

### AWS

AWS is the intended hosting layer.

For the hackathon, do not overbuild AWS infrastructure.

The MVP may run locally first and be deployed only after the loop works.

### Sol + Luna

Sol and Luna are development-only.

They are not part of the production runtime.

---

## Hackathon Architecture

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

This is intentionally small.

---

## Capability Profile

The capability profile is the source of truth.

Example:

```json
{
  "name": "candidate",
  "positioning": "AI creative director and GTM operator",
  "skills": [
    "AI automation",
    "GTM systems",
    "content systems",
    "TypeScript",
    "workflow design"
  ],
  "experience": [],
  "results": [],
  "case_studies": [],
  "constraints": []
}
```

The same profile can later generate an ATS-friendly resume.

For the demo, use the structured JSON directly.

---

## Opportunity Score

The MVP uses a simple explainable score.

```text
score =
  capability fit * 40%
  +
  intent * 30%
  +
  evidence * 20%
  +
  urgency * 10%
```

Example output:

```json
{
  "score": 92,
  "capabilityFit": 95,
  "intent": 94,
  "evidence": 88,
  "urgency": 85,
  "reasons": [
    "role requires outbound automation",
    "matching capability exists",
    "company is actively hiring",
    "relevant technical overlap found"
  ]
}
```

The score should be explainable.

---

## Slack Approval

Slack is the human control point.

The approval card should include:

```text
company
role
match score
why it matches
generated outreach

[ Approve + Send ]
[ Reject ]
```

This is the main visible governance moment in the demo.

---

## Gmail Safety

Use:

```env
EMAIL_MODE=dry_run
```

during development.

Supported modes can be:

```text
dry_run
draft
live
```

Only switch to live execution after the flow has been tested.

---

## Storage

Keep storage simple.

Use:

- existing Postgres
- SQLite
- or JSON

Do not introduce new infrastructure unless it already exists.

Store:

```text
company
role
score
status
approved
sent_at
```

---

## What We Are Not Building

Not needed for the hackathon:

```text
microservices
SQS
EventBridge
dead-letter queues
multi-tenancy
full CRM abstraction
distributed tracing
full memory graph
complex event sourcing
multiple model providers
generic connector framework
production retry orchestration
```

These belong in the post-hackathon target architecture.

---

## Build Order

```text
1. inspect current repo
2. capability_profile.json
3. Greenhouse ingestion
4. normalization
5. match scoring
6. Gemini
7. Hermes
8. Slack approval
9. Gmail
10. storage
11. end-to-end test
12. demo polish
```

---

## 3-4 Hour Success Target

The project is on track if one real job can move through this complete sequence:

```text
discover
→ normalize
→ match
→ score
→ explain
→ generate
→ approve
→ send
→ save
```

Do not spend hackathon time making the repository look production-grade.

Make the loop work.

---

## Environment

Suggested `.env` shape:

```env
APP_ENV=development

GEMINI_API_KEY=

SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CHANNEL_ID=

GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

EMAIL_MODE=dry_run
```

Add only variables required by the implementation.

Never commit secrets.

---

## Run

Exact commands should be updated after the current repository is inspected.

Expected shape:

```bash
npm install
npm run dev
```

or:

```bash
pnpm install
pnpm dev
```

Do not invent commands that are not present in `package.json`.

---

## Demo Checklist

Before presenting:

```text
[ ] real job loads
[ ] match score appears
[ ] match reasoning appears
[ ] email is generated
[ ] Slack card works
[ ] reject works
[ ] approve works
[ ] Gmail dry-run or send works
[ ] result is stored
[ ] no secrets appear in logs
```

---

## Product Direction After Hackathon

The MVP may later evolve into:

```text
AWS
→ 24/7 scheduling
→ queue-based workers
→ persistent memory
→ richer intent sources
→ full ATS resume generation
→ CRM integrations
→ outcome learning
→ multi-tenant workspaces
```

None of that is required to prove the hackathon concept.

For now:

```text
one complete loop > perfect architecture
```
