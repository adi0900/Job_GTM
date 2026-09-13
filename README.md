# Odyva GTM

Odyva GTM is a 24/7 autonomous GTM operating system that continuously finds live buying intent, matches it against a verified capability profile, prepares the highest-probability conversion action, routes reputation-bearing actions through human approval, executes through deterministic integrations, and learns from outcomes.

This repository is being built AI-first, so the codebase is intentionally optimized for clear contracts, explicit system boundaries, small vertical tasks, and reliable handoff between coding agents.

---

## Product Thesis

Most GTM stacks are fragmented.

A typical early-stage company may have separate tools for:

- lead discovery
- enrichment
- research
- copy generation
- CRM
- email
- social
- spreadsheets
- analytics

The intelligence is not the missing layer.

The missing layer is a closed operational loop.

Odyva connects:

```text
intent
→ understanding
→ matching
→ reasoning
→ human approval
→ execution
→ outcome
→ memory
→ next action
```

The goal is not to automate random sales tasks.

The goal is to make GTM behave like an engineered system.

---

## Production Architecture

The core runtime model is:

```text
AWS
  ↓
Hermes
  ↓
Gemini API
  ↓
Domain tools
  ↓
Slack approval
  ↓
Execution
  ↓
Outcomes
  ↓
Memory
```

### AWS

AWS is the infrastructure layer.

It will eventually handle:

- compute
- queues
- schedules
- persistence
- storage
- secrets
- observability
- retries
- production recovery

### Hermes

Hermes is the production GTM operator.

It coordinates tools, memory, execution state, and approval-aware workflows.

Hermes should reason in terms of business tools such as:

```text
searchOpportunities()
getCompanyContext()
matchCapabilityProfile()
scoreOpportunity()
generateOutbound()
requestHumanApproval()
sendOutbound()
recordOutcome()
```

It should not directly know vendor-specific API details.

### Gemini API

Gemini is the primary production model provider.

Expected uses include:

- structured extraction
- classification
- evidence interpretation
- personalization
- synthesis
- outbound generation
- reasoning over structured context

Model calls are bounded by schemas and system contracts.

### Sol + Luna

Sol and Luna are development-only.

They may be used for:

- coding
- architecture
- testing
- debugging
- implementation support

They are not part of the Odyva production runtime.

---

## 24/7 GTM Search

Odyva continuously looks for real, current commercial intent.

Initial discovery targets:

- Greenhouse
- Lever
- company careers pages

A job opening is treated as a live operational signal.

Example:

```text
company posts:
"Founding Growth Engineer"

requirements mention:
- outbound systems
- TypeScript
- automation
- CRM
- enrichment

Odyva interprets:
active budget + current growth infrastructure problem
```

That signal is then matched against the user's verified capability profile.

---

## Capability Profile + ATS Resume

Odyva does not treat the resume as the canonical data structure.

The canonical object is a structured capability profile.

Example:

```text
capability_profile
├── identity
├── positioning
├── roles
├── skills
├── technologies
├── industries
├── experience
├── achievements
├── quantified_results
├── case_studies
├── products
├── offers
├── evidence
└── constraints
```

The ATS-friendly resume is generated from this structured profile.

The same profile powers:

- opportunity matching
- qualification
- proof selection
- outbound personalization
- brand memory
- conversion scoring

This prevents the system from repeatedly reparsing a PDF and reduces hallucinated claims.

---

## Opportunity Matching

The system should answer:

```text
does this company currently have a problem
that our verified capabilities can solve?

if yes:

how strong is the fit?
what evidence proves it?
who owns the problem?
how urgent is it?
what should we do next?
```

Matching should not be one ungrounded LLM score.

Conceptually:

```text
opportunity score
=
intent
× capability fit
× evidence strength
× urgency
× buyer relevance
× reachability
× historical conversion prior
```

A scored opportunity should remain explainable.

Example:

```json
{
  "company": "Acme",
  "signal": "Founding Growth Engineer posted 14 hours ago",
  "overall_score": 91,
  "intent": 96,
  "capability_fit": 94,
  "evidence_strength": 88,
  "urgency": 93,
  "buyer_relevance": 89,
  "reachability": 82,
  "reasons": [
    "actively hiring for outbound infrastructure",
    "requires TypeScript and automation",
    "verified matching case study exists",
    "relevant decision-maker identified"
  ]
}
```

Gemini may help extract and interpret the evidence.

It must not invent the evidence.

---

## Human Approval

Odyva automates work, not accountability.

The current product uses Slack as the command center.

Example flow:

```text
opportunity found
  ↓
Hermes recommendation
  ↓
Gemini-generated outbound
  ↓
Slack card

[ Approve + Send ]
[ Copy Social Post ]
[ Reject ]
```

External buyer contact should remain gated by explicit approval.

---

## Execution Hierarchy

Integrations should be implemented in this order:

```text
Structured API
    >
MCP protocol
    >
Deterministic script
    >
Computer use
```

Computer use is an edge-case fallback.

The system should prefer deterministic, observable execution.

---

## Initial External Systems

Current target integrations:

```text
Greenhouse / Lever
    ↓
live intent

Slack
    ↓
human approval

Gmail API
    ↓
outbound execution

Google Sheets
    ↓
living record

Gemini API
    ↓
AI reasoning + generation

Hermes
    ↓
orchestration

AWS
    ↓
production runtime
```

Additional CRM and signal integrations can be added after the primary loop is working.

---

## Core Domain Separation

Three concepts must remain distinct.

### Signal

What happened externally.

```text
Acme posted a Senior Growth Engineer role.
```

### Opportunity

What that signal means commercially.

```text
Acme likely has an active outbound infrastructure problem.
```

### Action

What Odyva recommends doing.

```text
Send proof X to buyer Y with message Z.
```

This distinction is fundamental to keeping the product debuggable.

---

## Repo Philosophy

This repository is being built with AI coding agents.

The priority is not immediate structural perfection.

The priority is:

```text
machine-readable architecture
>
small tasks
>
explicit contracts
>
tests
>
one complete working vertical loop
```

The current codebase may not yet match the target architecture.

That is expected.

Do not assume a folder exists just because it appears in the target architecture.

---

## Target Repository Shape

The repo should gradually converge toward:

```text
odyva-gtm/
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── VISION.md
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── TARGET_STATE.md
│   ├── DOMAIN.md
│   ├── DATA_MODEL.md
│   ├── EVENT_CATALOG.md
│   └── DECISIONS.md
│
├── tasks/
│   ├── TASK-001-...
│   ├── TASK-002-...
│   └── ...
│
├── apps/
├── packages/
├── connectors/
├── workflows/
├── infra/
├── evals/
└── tests/
```

Conceptual ownership:

```text
apps/
deployable processes

packages/
domain capabilities

connectors/
external services

workflows/
long-running business processes

infra/
AWS

evals/
AI quality

tasks/
implementation instructions for coding agents

docs/
persistent system context
```

The repo should migrate toward these boundaries incrementally.

---

## Recommended Build Order

### 1. Repository control layer

Create and maintain:

- `AGENTS.md`
- `README.md`
- `docs/VISION.md`
- `docs/CURRENT_STATE.md`
- `docs/TARGET_STATE.md`
- task files

### 2. Capability profile

Create the structured source of truth that powers the ATS-friendly resume and matching engine.

### 3. Live intent ingestion

Start with:

- Greenhouse
- Lever

Normalize both into one internal signal format.

### 4. Domain model

Separate:

```text
signal
opportunity
action
```

### 5. Matching engine

Build deterministic scoring with evidence.

### 6. Gemini provider

Create one clean provider abstraction.

Do not scatter raw Gemini calls across the codebase.

### 7. Hermes runtime

Expose domain tools to Hermes.

### 8. Slack approval

Implement human governance before live execution.

### 9. Gmail + records

Add outbound and record-keeping.

### 10. Outcomes + memory

Persist:

- sent
- replied
- rejected
- meeting booked
- opportunity created
- customer won

Use outcomes to improve future ranking.

### 11. AWS runtime

Move the working loop into continuous production infrastructure.

### 12. Evals + observability

Add:

- regression datasets
- hallucination checks
- matching accuracy
- traces
- alerts
- retry visibility
- failure recovery

---

## First Major Milestone

The first meaningful system milestone is one complete loop.

```text
Greenhouse role discovered

↓

normalized

↓

matched against capability profile

↓

opportunity scored

↓

Hermes prepares recommendation

↓

Gemini generates grounded outbound

↓

Slack approval card appears

↓

human approves

↓

Gmail sends

↓

record is persisted

↓

outcome is captured

↓

future matching can use that outcome
```

One working end-to-end loop is more valuable than a perfectly organized but disconnected repository.

---

## Development Safety

Development should default to:

```env
APP_ENV=development
EXECUTION_MODE=dry_run
```

Suggested behavior:

```text
Gmail       → draft or log
Slack       → development channel
CRM         → fixture / sandbox
Job boards  → read-only
Gemini      → real or mocked
```

Production should require explicit live configuration plus human approval.

---

## AI Coding Workflow

Before making meaningful changes:

```text
1. read AGENTS.md
2. read README.md
3. read CURRENT_STATE.md
4. read TARGET_STATE.md
5. read the active task
6. inspect the relevant implementation
7. implement the smallest complete slice
8. run tests
9. fix failures
10. update docs if system behavior changed
```

Do not perform broad cleanup unless it is explicitly part of the task.

Do not assume target architecture equals current architecture.

---

## Current Standard

Odyva should eventually be able to say:

```text
we know what you can actually do.

we continuously search for companies that need it now.

we rank who is most likely to convert.

we prepare the action.

you approve the reputation-bearing step.

the system executes it.

the outcome becomes memory.

the next search gets better.
```

That is the product.
