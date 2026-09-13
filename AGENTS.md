# AGENTS.md

# Odyva GTM Hackathon Agent Instructions

## Goal

Build the smallest complete Odyva GTM demo that proves the product thesis.

The hackathon MVP must show one end-to-end flow:

```text
live job signal
→ normalize
→ match against capability profile
→ score opportunity
→ Hermes
→ Gemini API
→ Slack approval
→ Gmail send or dry-run
→ save result
```

Do not optimize for production architecture.

Optimize for:

- working demo
- clear product story
- visible outputs
- minimal moving parts
- fast verification
- safe execution

---

## Product

Odyva GTM is a 24/7 GTM search and conversion assistant.

It continuously looks for companies showing live buying intent, matches those opportunities against a verified capability profile, prepares the best outreach, asks for human approval in Slack, and then executes.

The hackathon demo should prove:

```text
we know what you can do
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
```

---

## Production Roles

### Hermes

Hermes is the production operator.

For the hackathon, Hermes should coordinate:

- opportunity analysis
- tool calls
- reasoning flow
- action preparation

Do not build a complex agent framework.

Expose a few clear tools and keep the orchestration understandable.

### Gemini API

Gemini is the main AI caller.

Use it for:

- job pain extraction
- capability matching support
- company reasoning
- outreach generation
- concise opportunity explanation

Do not scatter Gemini calls across the codebase.

Keep Gemini access in one file or one small provider module.

### AWS

AWS may be used to host the demo runtime.

Do not build a distributed AWS architecture for the hackathon.

No need for:

- SQS
- EventBridge
- ECS service mesh
- dead-letter queues
- distributed tracing
- multi-region infrastructure

If local execution is faster, build locally first.

### Sol + Luna

Sol and Luna are development-only.

They may assist with coding and debugging.

They are not part of the runtime demo.

---

## Hackathon Scope

### Must Have

1. fetch at least one real live opportunity
2. normalize it
3. compare it against a structured capability profile
4. calculate an explainable match score
5. generate a short match explanation
6. generate a personalized outbound email
7. send the approval request to Slack
8. support approve / reject
9. on approval, send or dry-run Gmail
10. save the final result

### Nice to Have

Only after the full loop works:

- Lever in addition to Greenhouse
- ATS resume rendering
- Google Sheets logging
- simple dashboard
- recent-job filter
- contact lookup
- basic memory

### Out of Scope

Do not build during the hackathon:

- multi-tenancy
- microservices
- queue infrastructure
- complex event architecture
- full CRM abstraction
- advanced observability
- production-grade retry orchestration
- full memory graph
- generalized plugin system
- computer-use automation
- multiple AI providers
- large eval framework

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

Do not create extra packages or services unless the current codebase already needs them.

---

## Core Data Flow

```text
Greenhouse
  ↓
greenhouse.ts
  ↓
NormalizedJob
  ↓
matcher.ts
  ↓
OpportunityMatch
  ↓
hermes.ts
  ↓
gemini.ts
  ↓
Slack approval
  ↓
gmail.ts
  ↓
storage.ts
```

---

## Capability Profile

Use one structured JSON file.

Example:

```json
{
  "name": "candidate",
  "positioning": "AI creative director and GTM operator",
  "skills": [
    "AI automation",
    "GTM systems",
    "content",
    "TypeScript",
    "workflow design"
  ],
  "experience": [],
  "results": [],
  "case_studies": [],
  "constraints": []
}
```

This file is the source of truth for matching.

Do not rely on repeatedly parsing a PDF during the demo.

The ATS-friendly resume can be generated from the same profile later.

Never invent capabilities, results, or proof.

---

## Opportunity Model

Keep it simple.

```ts
type Opportunity = {
  company: string
  role: string
  sourceUrl: string
  postedAt?: string
  requirements: string[]
  painPoints: string[]
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

Use deterministic scoring.

Suggested MVP formula:

```text
score =
  capabilityFit * 0.40 +
  intent        * 0.30 +
  evidence      * 0.20 +
  urgency       * 0.10
```

Gemini may help classify or extract the inputs.

Gemini should not simply invent the final score.

A result should be explainable.

Example:

```text
92% match

why:
- role requires outbound automation
- candidate has matching workflow experience
- company is actively hiring now
- relevant technical stack overlap exists
```

---

## Hermes Tools

Keep Hermes tools minimal.

Recommended:

```text
getLiveJobs()
matchOpportunity()
generateOutreach()
requestApproval()
sendApprovedEmail()
saveResult()
```

Hermes should not directly contain raw Gmail, Slack, or Greenhouse SDK logic.

---

## Slack Approval

The Slack card should show:

- company
- role
- match score
- why it matches
- generated email
- approve
- reject

Do not overdesign the UI.

The demo needs one obvious approval moment.

---

## Gmail

Default to safe execution while building.

Recommended:

```env
EMAIL_MODE=dry_run
```

Modes:

```text
dry_run
draft
live
```

Only enable `live` after the complete flow works.

---

## Storage

For the hackathon, storage can be simple.

Allowed:

- JSON file
- SQLite
- existing Postgres

Do not introduce a new database only for architectural purity.

Store enough to show:

```text
company
role
score
status
approved/rejected
sent_at
```

---

## 24/7 Claim

The architecture should support continuous execution conceptually.

For the demo, a simple interval or scheduled function is enough.

Example:

```text
run search every 15 minutes
```

Do not build full production scheduling infrastructure unless already available.

---

## Development Safety

Use safe defaults:

```env
APP_ENV=development
EMAIL_MODE=dry_run
```

Never let an AI coding agent accidentally send live outreach during implementation.

---

## AI Coding Rules

Before changing code:

1. read this file
2. read `README.md`
3. inspect the actual repository
4. read `docs/CURRENT_STATE.md`
5. identify the smallest missing part of the demo loop
6. implement only that part
7. test it
8. continue to the next missing part

Do not perform broad refactors while the demo loop is incomplete.

Do not create architecture that is not required for the demo.

Do not replace working code because a cleaner design exists.

---

## Build Order

Use this order:

```text
1. inspect repo
2. capability profile
3. Greenhouse fetch
4. normalization
5. match scoring
6. Gemini generation
7. Hermes orchestration
8. Slack approval
9. Gmail dry-run / send
10. result storage
11. end-to-end test
12. demo polish
```

---

## Demo Success Condition

The hackathon MVP is successful when one real opportunity goes through this full flow:

```text
job discovered
→ matched
→ scored
→ explained
→ outreach generated
→ Slack approval shown
→ approved
→ Gmail executed
→ result saved
```

Everything else is secondary.

---

## Definition of Done

A feature is done when:

- it works in the demo flow
- its output is visible
- it has basic error handling
- it does not break the next step
- it can be tested quickly
- it does not require production-grade infrastructure

The primary rule:

```text
working demo > perfect architecture
```
