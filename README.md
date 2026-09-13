# Odyva GTM

> 24/7 AI-powered GTM search that finds live operational intent, matches it against verified capabilities, prepares the highest-probability conversion action, asks for human approval, executes it, and records the outcome.

---

## 01. Project Overview

### What we built

Odyva GTM is a multi-app AI agent that continuously looks for companies showing live hiring intent and turns that signal into an actionable, human-approved GTM opportunity.

The core loop is:

```text
Greenhouse
→ capability matching
→ opportunity scoring
→ Hermes orchestration
→ Gemini reasoning
→ Slack approval
→ Gmail execution
→ Google Sheets record
```

Instead of asking an AI model to perform disconnected tasks such as:

```text
"research this lead"
"write this email"
"personalize these contacts"
```

Odyva connects the entire workflow.

It answers:

```text
who needs what we can actually do right now?

how strong is the match?

why is it a match?

what should we send?

should a human approve it?

what happened after execution?
```

### The problem

Early-stage founders still manually move between:

```text
job boards
browser research
AI chat
Slack
Gmail
spreadsheets
```

The intelligence exists.

The operating loop is fragmented.

Odyva connects that loop.

### What makes the signal useful

A live job posting is more than a job listing.

It can indicate:

```text
active budget
+
current operational pain
+
clear capability requirements
+
a company trying to solve the problem now
```

Example:

```text
Company:
Acme

Role:
Founding Growth Engineer

Requirements:
outbound systems
automation
TypeScript
CRM
enrichment
```

Odyva can interpret that as:

```text
Acme is actively investing in growth infrastructure.
```

It then compares that need against a structured capability profile.

### Capability matching

The source of truth is a structured capability profile.

Example:

```json
{
  "positioning": "AI creative director and GTM operator",
  "skills": [
    "AI automation",
    "GTM systems",
    "workflow design",
    "TypeScript"
  ],
  "experience": [],
  "results": [],
  "case_studies": [],
  "constraints": []
}
```

The same profile can later generate an ATS-friendly resume.

For this MVP, the structured profile directly powers matching.

### Opportunity scoring

The MVP uses an explainable score:

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

Example:

```text
92% match

capability fit: 95
intent: 94
evidence: 88
urgency: 85

why:
- role requires outbound automation
- matching GTM systems experience exists
- relevant technical overlap exists
- company is actively hiring now
```

Gemini can assist with extraction and reasoning, but the final score remains decomposable and understandable.

### Human approval

Odyva does not automatically commit the user's reputation to an external buyer.

Slack acts as the human gate:

```text
ODYVA OPPORTUNITY

Company: Acme
Role: Founding Growth Engineer
Match: 92%

Why:
- outbound automation requirement
- strong capability overlap
- active hiring intent

Email:
[generated outreach]

[ Approve + Send ]
[ Reject ]
```

Only approved actions continue to Gmail.

### Result

After execution, Odyva records the outcome in Google Sheets so the workflow ends with a visible external record.

---

## 02. External Apps Used

Odyva connects to four external apps.

### 1. Greenhouse

**Purpose:** live GTM intent discovery.

Odyva reads real job openings and uses them as current operational signals.

```text
Greenhouse
→ real job
→ normalized opportunity
```

### 2. Slack

**Purpose:** human approval and governance.

Slack displays:

```text
company
role
match score
match reasons
generated outreach
```

The user can:

```text
Approve + Send
Reject
```

### 3. Gmail

**Purpose:** approved outbound execution.

After explicit approval, Odyva can:

```text
dry-run
create draft
send live email
```

depending on configuration.

### 4. Google Sheets

**Purpose:** persistent external GTM record.

Odyva appends the final decision and execution status to a Google Sheet.

Suggested row:

```text
timestamp
company
role
source URL
match score
decision
email status
```

### AI + Agent Runtime

The system also uses:

**Hermes**

```text
runtime operator
workflow coordination
tool orchestration
```

**Gemini API**

```text
job pain extraction
capability reasoning
opportunity explanation
outbound generation
```

Sol and Luna are development-only and are not part of the production demo flow.

---

## 03. Setup Instructions

> Important: replace any remaining `TODO` values below with the exact repository commands and configuration before submission.

### Prerequisites

You will need:

```text
Node.js / project runtime
Gemini API credentials
Slack app credentials
Gmail API credentials
Google Sheets API credentials
Greenhouse source
```

### 1. Clone the repository

```bash
git clone TODO_REPOSITORY_URL
cd odyva-gtm
```

### 2. Install dependencies

Use the command that exists in the repository.

```bash
TODO_INSTALL_COMMAND
```

Examples might be:

```bash
npm install
```

or:

```bash
pnpm install
```

Do not use an example command unless it matches the actual repository.

### 3. Configure environment variables

Create:

```text
.env
```

from:

```text
.env.example
```

Expected variables may include:

```env
APP_ENV=development

GEMINI_API_KEY=

SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CHANNEL_ID=

GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=

EMAIL_MODE=dry_run
```

Only include variables that the final implementation actually requires.

Never commit real secrets.

### 4. Configure Slack

Create or use a Slack app with permission to:

```text
post messages
receive button interactions
```

Set the development channel ID in:

```env
SLACK_CHANNEL_ID=
```

### 5. Configure Gmail

During development:

```env
EMAIL_MODE=dry_run
```

Supported modes may include:

```text
dry_run
draft
live
```

Only enable live sending after the full approval flow has been verified.

### 6. Configure Google Sheets

Create a spreadsheet for Odyva results.

The sheet should support at least these columns:

```text
timestamp
company
role
source_url
match_score
decision
email_status
```

Add its ID to:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=
```

### 7. Add capability profile

Create or update:

```text
data/capability_profile.json
```

with verified capabilities only.

Do not add invented results or case studies.

### 8. Run the project

Use the actual repository command:

```bash
TODO_RUN_COMMAND
```

### 9. Run tests

Use the actual test command:

```bash
TODO_TEST_COMMAND
```

---

## 04. Reliability Testing

Reliability is a core part of the project.

We test both the happy path and failure paths.

### Test 1: Happy Path

Flow:

```text
Greenhouse
→ match
→ Gemini
→ Slack approval
→ Gmail
→ Google Sheets
```

Expected:

```text
one opportunity
one approval
one email action
one Google Sheets row
successful final state
```

### Test 2: Reject Path

Flow:

```text
opportunity
→ Slack
→ Reject
```

Expected:

```text
zero Gmail sends
decision recorded
```

### Test 3: Duplicate Approval Protection

Flow:

```text
same action approved twice
```

Expected:

```text
only one Gmail action
```

This prevents duplicate outbound caused by repeated interactions or retries.

### Test 4: Gemini Failure

Simulated condition:

```text
invalid / unavailable model response
```

Expected:

```text
workflow fails safely
no Gmail execution
no false success state
```

### Test 5: Gmail Failure

Simulated condition:

```text
Gmail execution fails
```

Expected:

```text
error is surfaced
execution is not reported as successful
duplicate sends are prevented
```

### Test 6: Google Sheets Failure

Simulated condition:

```text
Google Sheets write fails
```

Expected:

```text
failure is visible
the system does not silently report a complete workflow
```

### Verification Results

Replace this block with the actual results before submission:

```text
test command:
TODO

tests passing:
TODO

tests failing:
TODO

manual happy-path verification:
TODO

manual reject-path verification:
TODO

duplicate-send verification:
TODO
```

Do not claim tests that were not actually run.

---

## 05. Demo Video

**Demo video:** TODO_DEMO_VIDEO_URL

Requirements:

```text
maximum duration: 2 minutes
publicly accessible to judges
```

Recommended demo sequence:

```text
0:00-0:15
show the problem + start live search

0:15-0:35
show a real Greenhouse opportunity

0:35-0:55
show capability match + score

0:55-1:15
show Gemini-generated reasoning + outreach

1:15-1:35
show Slack approval

1:35-1:50
show Gmail execution

1:50-2:00
show Google Sheets row + final thesis
```

---

# Architecture

The hackathon architecture intentionally stays small.

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
Slack
   ↓
Gmail
   ↓
Google Sheets
```

Suggested repo shape:

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

---

# Safety

Development defaults should remain safe.

```env
APP_ENV=development
EMAIL_MODE=dry_run
```

Rules:

```text
no live email without approval
no secrets committed
no invented capability evidence
no silent external-app failures
no duplicate email execution
```

---

# What We Intentionally Did Not Build

This is a hackathon MVP.

We intentionally avoided spending demo time on:

```text
microservices
SQS
EventBridge
dead-letter queues
multi-tenancy
full CRM abstraction
distributed tracing
full memory graph
multiple AI providers
complex event sourcing
production autoscaling
```

The objective is to prove the useful multi-app agent loop first.

---

# Future Direction

Post-hackathon, Odyva can expand into:

```text
24/7 scheduled search
multiple intent sources
ATS-friendly resume generation
persistent brand memory
CRM integrations
historical conversion learning
AWS workers
multi-tenant workspaces
automated opportunity reprioritization
```

The core thesis remains:

```text
find who needs what you can actually do
→ prove the fit
→ prepare the action
→ keep the human accountable
→ execute
→ record what happened
```
