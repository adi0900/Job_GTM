# ARCHITECTURE.md

## goal

the hackathon architecture should be:

```text
small
understandable
reliable
demoable
```

it should prove the complete multi-app flow without production overengineering.

---

## system flow

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
Hermes
   ↓
Gemini API
   ↓
Slack approval
   ↓
Gmail
   ↓
Google Sheets
```

---

## external app requirement

the system must visibly use at least three external apps.

odyva uses four:

```text
1. greenhouse
2. slack
3. gmail
4. google sheets
```

gemini is the model provider.

hermes is the runtime operator.

---

## recommended repo shape

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

do not split this into microservices during the hackathon.

---

## module contracts

### `src/index.ts`

role:

```text
entry point
```

responsibilities:

```text
load configuration
run one search cycle
coordinate the demo
surface errors
```

---

### `src/greenhouse.ts`

role:

```text
live intent source
```

responsibilities:

```text
fetch real jobs
normalize raw response
return predictable objects
```

suggested type:

```ts
type NormalizedJob = {
  id: string
  company: string
  role: string
  sourceUrl: string
  description: string
  postedAt?: string
}
```

---

### `src/matcher.ts`

role:

```text
capability match + deterministic scoring
```

responsibilities:

```text
extract relevant requirements
compare them to capability profile
calculate score components
return reasons
```

suggested output:

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

recommended scoring:

```text
score =
  capabilityFit * 0.40 +
  intent        * 0.30 +
  evidence      * 0.20 +
  urgency       * 0.10
```

---

### `src/hermes.ts`

role:

```text
runtime operator
```

recommended tools:

```text
getLiveJobs()
matchOpportunity()
generateOutreach()
requestApproval()
sendApprovedEmail()
recordResult()
```

hermes should not directly contain raw third-party sdk code.

---

### `src/gemini.ts`

role:

```text
primary ai provider
```

responsibilities:

```text
job pain extraction
requirement extraction
match explanation
outbound generation
```

all gemini calls should stay here or behind one small provider abstraction.

---

### `src/slack.ts`

role:

```text
human approval
```

the card should show:

```text
company
role
match score
reasons
generated email
```

actions:

```text
approve + send
reject
```

reject must stop gmail execution.

---

### `src/gmail.ts`

role:

```text
outbound action
```

modes:

```text
dry_run
draft
live
```

default:

```env
EMAIL_MODE=dry_run
```

duplicate approval should not produce duplicate email execution.

---

### `src/sheets.ts`

role:

```text
external persistent record
```

minimum row:

```text
timestamp
company
role
source_url
match_score
decision
email_status
```

a sheet write failure must be surfaced clearly.

---

### `src/storage.ts`

role:

```text
local/internal demo state
```

allowed:

```text
json
sqlite
existing postgres
```

do not introduce a new database unless already present.

---

## capability profile

file:

```text
data/capability_profile.json
```

suggested structure:

```json
{
  "name": "candidate",
  "positioning": "",
  "skills": [],
  "technologies": [],
  "experience": [],
  "results": [],
  "case_studies": [],
  "constraints": []
}
```

this is the matching source of truth.

---

## reliability architecture

the architecture must support these testable guarantees.

### approval guarantee

```text
no approval
→ no gmail execution
```

### reject guarantee

```text
reject
→ zero sends
```

### duplicate guarantee

```text
same approval twice
→ one send maximum
```

### model failure guarantee

```text
gemini failure
→ no external action
```

### gmail failure guarantee

```text
gmail failure
→ visible failure
→ no false success
```

### google sheets failure guarantee

```text
sheet failure
→ visible failure
→ no fake completed state
```

---

## idempotency for the mvp

the hackathon does not need a distributed idempotency service.

a simple action id is enough.

example:

```text
action_id = hash(company + role + generated_email)
```

before executing gmail:

```text
if action_id already executed:
    return previous result
```

the implementation may be simpler if the current repo already has a better mechanism.

---

## local-first architecture

recommended sequence:

```text
build locally
→ test full loop
→ optionally deploy
```

do not delay the demo for aws infrastructure.

---

## aws

aws is the intended hosting layer.

for the hackathon, acceptable architecture is:

```text
one runtime service
```

or even:

```text
local demo
```

if deployment would consume time better spent on reliability.

---

## safe defaults

```env
APP_ENV=development
EMAIL_MODE=dry_run
```

never:

```text
commit secrets
log secrets
send without approval
silently swallow failure
invent capability proof
```

---

## architecture non-goals

not required:

```text
sqs
eventbridge
microservices
dead-letter queues
distributed tracing
multi-tenancy
generic plugin framework
crm abstraction
memory graph
multiple model providers
```

---

## end-to-end proof

the architecture is successful when this works:

```text
real greenhouse job
→ normalized job
→ match score
→ gemini explanation
→ slack approval
→ gmail execution
→ google sheets row
```

and when the failure paths behave correctly.
