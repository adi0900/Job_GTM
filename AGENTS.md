# AGENTS.md

# Odyva GTM Agent Instructions

## Product

Odyva GTM is a 24/7 autonomous GTM operating system.

Its job is to continuously discover live buying intent, match that intent against a verified capability profile, recommend the highest-probability action, route external communication through human approval, execute through deterministic integrations, and learn from outcomes.

Production runtime:

```text
AWS
  ↓
Hermes
  ↓
Gemini API
  ↓
Domain tools
  ↓
Human approval in Slack
  ↓
Execution
  ↓
Outcomes
  ↓
Memory
  ↓
Next run
```

Sol and Luna are development-only models.

They may assist with coding, testing, architecture, debugging, and development workflows.

They must never be represented as production agents, production inference providers, or runtime dependencies.

---

## Core Product Loop

```text
live intent
  ↓
normalize signal
  ↓
match against capability profile
  ↓
score opportunity
  ↓
Hermes decides recommended action
  ↓
Gemini performs bounded reasoning / generation
  ↓
Slack approval
  ↓
execute through API / MCP / script
  ↓
record outcome
  ↓
update memory
  ↓
improve future ranking
```

The system is not a cold-email generator.

It is a closed-loop GTM operating system.

---

## Primary Runtime Responsibilities

### AWS

AWS is the infrastructure and runtime layer.

Expected responsibilities include:

- compute
- scheduling
- queues
- persistence
- secrets
- observability
- storage
- recovery
- production networking

AWS is not the reasoning layer.

---

### Hermes

Hermes is the production agentic operating layer.

Hermes is responsible for:

- planning
- tool selection
- workflow coordination
- execution state
- memory access
- checkpoints
- policy enforcement
- deciding when human approval is required

Hermes must call domain-level tools.

Hermes must not contain vendor-specific integration logic.

Good:

```text
Hermes
  ↓
searchOpportunities()
  ↓
intent connector
  ↓
Greenhouse
```

Bad:

```text
Hermes
  ↓
raw Greenhouse HTTP request
```

---

### Gemini API

Gemini is the primary production AI provider.

Use Gemini for bounded tasks such as:

- structured extraction
- classification
- synthesis
- evidence interpretation
- personalization
- message generation
- reasoning over structured context

Do not allow Gemini to become the source of truth for deterministic system state.

Do not let Gemini directly perform irreversible external actions.

All Gemini access must go through the central AI provider abstraction.

---

## Capability Profile

The user's ATS-friendly resume is not the source of truth.

The source of truth is a structured capability profile.

The ATS-friendly resume is one generated representation of that profile.

Minimum conceptual structure:

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

The capability profile is used for:

- ATS resume generation
- opportunity matching
- outbound personalization
- proof selection
- case-study selection
- brand memory
- conversion scoring

Never invent experience, results, skills, customers, credentials, or case studies.

Every material claim must be traceable to evidence.

---

## Domain Model

Keep these concepts separate.

### Signal

Something observed externally.

Example:

```text
Acme posted a Senior Growth Engineer role 14 hours ago.
```

### Opportunity

The commercial interpretation of the signal.

Example:

```text
Acme likely has an outbound systems bottleneck and active budget.
```

### Action

What Odyva recommends doing.

Example:

```text
Send the founder case study X with message Y.
```

Do not collapse signal, opportunity, and action into one object.

---

## Architectural Rules

1. Never place business logic directly inside route handlers.

2. Never call Gemini directly from domain modules.

3. All model calls go through the shared AI provider layer.

4. All external applications go through connectors.

5. Hermes calls domain tools, not vendor-specific APIs.

6. Every external write must be idempotent.

7. Outbound communication requires explicit human approval unless a future product policy explicitly changes this.

8. Workflow state must be persistable and resumable.

9. All external input must be schema-validated.

10. Postgres is the authoritative system of record.

11. Queues contain work, not business truth.

12. AI output must never silently overwrite verified structured data.

13. Every score should retain the evidence used to produce it.

14. Every irreversible action must be auditable.

15. Every task must include verification before it is considered complete.

16. Prefer explicit contracts over implicit behavior.

17. Prefer deterministic logic before probabilistic reasoning.

18. Prefer vertical slices over broad repo rewrites.

19. Do not refactor unrelated areas while completing a scoped task.

20. Do not redesign working systems unless the task explicitly requires it.

---

## Execution Hierarchy

Use integrations in this order:

```text
Structured API
    >
MCP protocol
    >
Deterministic script
    >
Computer use
```

Computer use is the final fallback, not the default integration strategy.

Do not build fragile mouse-clicking automation where stable APIs exist.

---

## Human Governance

Odyva automates work, not accountability.

Good candidates for automation:

- discovering companies
- parsing job descriptions
- matching requirements
- researching company context
- ranking opportunities
- drafting messaging
- updating internal records

External reputation-bearing actions require approval.

Examples:

- send email
- publish social content
- modify customer-facing CRM state
- contact a buyer
- submit a form on behalf of the user

Slack is the primary human approval surface for the current product.

---

## Opportunity Scoring

Do not ask a model for one ungrounded score such as:

```text
"Give this lead a score from 1 to 100."
```

Use structured factors.

Current conceptual score:

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

Implementation may use weighted normalization rather than literal multiplication.

The important rule is that the score must be decomposable.

A match should be explainable as:

```json
{
  "overall_score": 91,
  "intent": 96,
  "capability_fit": 94,
  "evidence_strength": 88,
  "urgency": 93,
  "buyer_relevance": 89,
  "reachability": 82
}
```

Gemini may extract evidence, classify context, or explain the result.

Gemini must not invent unsupported evidence.

---

## 24/7 Discovery

Odyva should eventually run continuously.

Target event flow:

```text
scheduler
  ↓
source discovery
  ↓
queue
  ↓
ingestion
  ↓
normalization
  ↓
signal discovered
  ↓
opportunity matching
  ↓
opportunity scored
  ↓
Hermes
  ↓
Gemini
  ↓
asset generated
  ↓
Slack approval
  ↓
approved action
  ↓
execution
  ↓
outcome
  ↓
memory update
```

Avoid one giant synchronous function for the entire loop.

Each stage should be retryable independently.

---

## Source Integrations

Initial live intent sources:

- Greenhouse
- Lever
- company careers pages

Future sources may include:

- Ashby
- CRM signals
- social intent
- funding events
- product usage signals
- website intent
- email engagement
- customer support signals

New sources must normalize into the same internal signal contract.

Vendor-specific schemas must not leak across the domain layer.

---

## Development Environment Safety

Development must default to dry-run behavior.

Recommended default:

```env
APP_ENV=development
EXECUTION_MODE=dry_run
```

Expected behavior:

```text
Gmail       → log / draft only
Slack       → development channel
CRM         → sandbox or fixture
Greenhouse  → real read or fixture
Lever       → real read or fixture
Gemini      → real or mocked depending on task
```

Production execution should require:

```env
APP_ENV=production
EXECUTION_MODE=live
```

plus an approved action.

Never assume a development environment is safe to perform live external writes.

---

## AI Development Workflow

This repository is being built heavily with AI coding agents.

Before starting implementation, read:

1. `AGENTS.md`
2. `README.md`
3. `docs/VISION.md` if present
4. `docs/CURRENT_STATE.md` if present
5. `docs/TARGET_STATE.md` if present
6. the active task file

Then:

```text
understand current state
  ↓
identify smallest complete vertical slice
  ↓
write implementation plan
  ↓
modify only relevant files
  ↓
run tests / checks
  ↓
fix failures
  ↓
document material architectural change
  ↓
update current state
```

Do not infer that the target architecture already exists.

The repository may contain legacy or prototype code.

Preserve working behavior unless migration is explicitly part of the task.

---

## Task Discipline

Each meaningful task should define:

- objective
- current state
- inputs
- outputs
- constraints
- acceptance criteria
- files likely involved
- tests required
- known non-goals

Tasks should be small enough to complete and verify in one development session where possible.

Bad task:

```text
build Odyva
```

Good task:

```text
normalize Greenhouse job data into OpportunitySignal v1
```

---

## Testing Standard

Minimum expectations:

### Unit tests

For:

- scoring
- parsing
- validation
- normalization
- deterministic transforms
- policy checks

### Contract tests

For:

- connectors
- provider interfaces
- event schemas
- public tool interfaces

### Integration tests

For:

- database flows
- queue flows
- Gemini provider
- Slack approval lifecycle
- execution lifecycle

### End-to-end tests

For the complete vertical path:

```text
signal
→ match
→ score
→ generate
→ approve
→ execute
→ record outcome
```

### Failure tests

Cover:

- duplicate events
- provider timeout
- malformed AI output
- queue retry
- duplicate approval
- duplicate send
- partial workflow failure
- database reconnect
- invalid credentials
- stale execution state

---

## Observability

Every production workflow should be traceable.

Where possible, record:

- workflow id
- signal id
- opportunity id
- action id
- approval id
- execution id
- model provider
- model name
- prompt version
- connector
- external request id
- latency
- retry count
- final status

Logs must never expose raw secrets.

Sensitive tokens must remain in the appropriate secrets system.

---

## Memory

Memory should improve future decisions without corrupting verified facts.

Keep different memory classes distinguishable:

- brand memory
- company memory
- interaction memory
- campaign memory
- outcome memory

Derived memory should retain provenance.

An observed conversion outcome is stronger evidence than an AI inference.

---

## Repository Boundaries

Target conceptual boundaries:

```text
apps/
deployable runtimes

packages/
domain and reusable capabilities

connectors/
external systems

workflows/
multi-step business processes

infra/
AWS infrastructure

evals/
AI quality and regression

tasks/
AI-readable implementation tasks

docs/
persistent architectural context
```

Do not move code purely for aesthetic reasons.

Migrate toward these boundaries as features are touched.

---

## Current Build Priority

The preferred implementation order is:

1. repo control layer
2. structured capability profile
3. live intent ingestion
4. signal / opportunity / action domain separation
5. opportunity matching
6. Gemini provider abstraction
7. Hermes runtime and domain tools
8. Slack approval
9. Gmail / records execution
10. persistent outcomes and memory
11. 24/7 AWS runtime
12. evals, observability, failure recovery

The first major product milestone is one complete working loop, not a perfectly organized repository.

---

## Definition of Done

A task is not done because code was generated.

It is done when:

- implementation is complete
- types pass
- tests pass
- behavior is verified
- external actions are safe
- failure states are considered
- relevant documentation is updated
- known limitations are recorded
- no unrelated system behavior was broken
