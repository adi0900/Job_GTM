# VISION.md

## odyva gtm

odyva gtm is a 24/7 ai-powered gtm search and conversion system.

the hackathon mvp proves one useful multi-step agent that takes action across multiple external apps:

```text
greenhouse
→ capability matching
→ hermes
→ gemini
→ slack approval
→ gmail
→ google sheets
```

the product thesis is simple:

```text
find who needs what you can actually do right now
→ prove the fit
→ prepare the action
→ keep the human accountable
→ execute
→ record what happened
```

---

## problem

early-stage founders and operators still move manually between:

```text
job boards
browser research
ai chat
slack
gmail
spreadsheets
```

the intelligence exists.

the workflow is fragmented.

odyva connects the entire loop.

---

## what odyva does

odyva continuously looks for companies showing live operational intent.

for the hackathon, the primary signal is a real job posting.

a job opening can indicate:

```text
active budget
+
current operational pain
+
clear capability requirements
+
a company trying to solve the problem now
```

odyva then:

```text
discovers the signal
→ normalizes it
→ matches it against verified capabilities
→ scores the opportunity
→ explains why the match exists
→ prepares outreach
→ asks for human approval
→ executes through gmail
→ records the final result in google sheets
```

---

## external apps

the mvp intentionally uses four external apps.

### greenhouse

role:

```text
live intent discovery
```

greenhouse provides current job opportunities that act as real commercial signals.

### slack

role:

```text
human approval
```

slack is the control layer.

the user sees:

```text
company
role
match score
reasons
generated outreach
```

and chooses:

```text
approve + send
reject
```

### gmail

role:

```text
approved outbound execution
```

gmail runs only after explicit approval.

development mode should default to:

```text
dry_run
```

### google sheets

role:

```text
persistent external record
```

every final decision should be visible in a sheet.

minimum fields:

```text
timestamp
company
role
source url
match score
decision
email status
```

---

## hermes

hermes is the runtime operator.

for the hackathon, hermes should coordinate a small tool surface:

```text
getLiveJobs()
matchOpportunity()
generateOutreach()
requestApproval()
sendApprovedEmail()
recordResult()
```

hermes should remain thin.

the demo should be understandable without explaining a large agent framework.

---

## gemini api

gemini is the primary ai caller.

use gemini for:

```text
job pain extraction
requirement extraction
capability overlap reasoning
concise opportunity explanation
personalized outbound generation
```

gemini must not:

```text
invent experience
invent customer results
invent case studies
send email directly
bypass human approval
```

---

## capability profile

odyva uses a structured capability profile as the matching source of truth.

example:

```json
{
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

the ats-friendly resume can be generated from this same profile later.

for the hackathon, structured data is enough.

---

## scoring

the mvp should use an explainable score.

recommended formula:

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

example:

```text
92% match

capability fit: 95
intent: 94
evidence: 88
urgency: 85
```

the judge should be able to understand why the score exists.

---

## human agency

odyva automates work, not accountability.

the agent may:

```text
research
extract
match
score
draft
prepare
record
```

the human owns:

```text
the final external contact decision
```

the slack approval step is therefore a core product feature, not just a demo button.

---

## hackathon definition of success

the mvp is successful when one real opportunity moves through:

```text
greenhouse
→ match
→ score
→ hermes
→ gemini
→ slack
→ gmail
→ google sheets
```

and when the system demonstrates that:

```text
reject = no email
approve = one email action
duplicate approval = no duplicate send
failure = visible failure, not fake success
```

---

## what is intentionally not in scope

do not build for the hackathon:

```text
microservices
sqs
eventbridge
dead-letter queues
multi-tenancy
distributed tracing
full crm abstraction
full memory graph
multiple ai providers
complex event sourcing
production autoscaling
```

---

## post-hackathon direction

after the mvp, odyva can expand into:

```text
24/7 scheduled search
lever + ashby + careers pages
ats resume generation
persistent memory
crm integrations
historical conversion learning
aws workers
multi-tenant workspaces
automatic opportunity reprioritization
```

but the hackathon objective remains:

```text
one complete, reliable, multi-app conversion loop
```
