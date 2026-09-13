# DEMO_FLOW.md

## objective

the demo must prove one useful multi-step ai agent acting across multiple external apps.

target duration:

```text
90 to 120 seconds
```

external apps shown:

```text
greenhouse
slack
gmail
google sheets
```

---

## one-sentence demo thesis

```text
odyva finds companies that need what you can actually do right now, ranks the best opportunity, prepares the outreach, asks you to approve it, executes it, and records the result.
```

---

## pre-demo checklist

before recording:

```text
[ ] real greenhouse opportunity available
[ ] backup saved real opportunity available
[ ] capability profile loaded
[ ] gemini working
[ ] hermes flow working
[ ] slack app connected
[ ] gmail in chosen mode
[ ] google sheets connected
[ ] happy path tested
[ ] reject path tested
[ ] duplicate approval tested
[ ] no secrets visible
```

---

## recommended timing

### 0:00 to 0:12

show the problem.

script idea:

```text
founders still manually jump between job boards, ai, slack, gmail, and spreadsheets just to find companies that need what they sell.
```

then:

```text
odyva turns that into one agentic loop.
```

---

## 0:12 to 0:30

### show greenhouse

trigger a real search.

show:

```text
company
role
posted time
source
```

example:

```text
Acme
Founding Growth Engineer
posted 11 hours ago
source: Greenhouse
```

say:

```text
this is live operational intent, not a static lead list.
```

---

## 0:30 to 0:48

### show capability match

show:

```text
92% match
```

with breakdown:

```text
capability fit: 95
intent: 94
evidence: 88
urgency: 85
```

and 3 to 4 reasons:

```text
role requires outbound automation
matching gtm systems experience exists
relevant technical overlap exists
company is actively hiring now
```

do not show a wall of text.

---

## 0:48 to 1:05

### show hermes + gemini output

show concise reasoning:

```text
likely pain:
the company is trying to build repeatable outbound infrastructure.

why now:
the role is currently open, which signals active budget and urgency.
```

then show the generated email.

target:

```text
3 to 5 sentences
```

---

## 1:05 to 1:25

### show slack

the slack approval card is the main governance moment.

show:

```text
ODYVA OPPORTUNITY

Company: Acme
Role: Founding Growth Engineer
Match: 92%

Why:
• outbound automation need
• strong capability overlap
• active hiring intent

Email:
[generated message]

[ Approve + Send ]
[ Reject ]
```

say:

```text
odyva automates the work, not the accountability.
```

---

## 1:25 to 1:42

### approve

click:

```text
Approve + Send
```

show:

```text
approved
```

the workflow has already prepared the real Gmail draft. After approval, show:

```text
Gmail drafts.send executed
real message id captured
```

final AWS runtime modes:

```text
GMAIL_MODE=live
EMAIL_MODE=live
```

The application sends only after the explicit Slack approval. Reject never sends.

---

## 1:42 to 1:55

### show google sheets

show the new row.

example:

```text
2026-09-13
Acme
Founding Growth Engineer
92
approved
sent
```

this is the visible close of the multi-app loop.

---

## 1:55 to 2:00

### final line

```text
odyva continuously finds who needs what you can actually do, prepares the highest-probability action, keeps the human in control, and executes across the stack.
```

stop.

do not use the final seconds for roadmap slides.

---

## reliability proof

the README should show the full test suite, but the demo can briefly mention:

```text
reject = no send
duplicate approval = one send
failed model call = no external action
```

if there is time, flash the passing tests for 1 to 2 seconds.

do not derail the product demo.

---

## backup demo path

never depend entirely on a third-party live response.

keep one saved real opportunity.

fallback:

```text
saved real greenhouse job
→ matcher
→ gemini
→ slack
→ gmail
→ google sheets
```

if greenhouse is slow during recording, use the saved real input and clearly label it as a previously fetched live opportunity.

---

## failure demo option

if the happy path is very fast, optionally show reject:

```text
click Reject
→ Gmail does not execute
→ sheet records rejected
```

this can strengthen reliability, but only if it does not make the video exceed two minutes.

---

## what not to show

do not spend the demo on:

```text
repo tree
aws internals
future microservices
queue design
database schema
event sourcing
long prompts
raw api responses
terminal noise
```

the judges should see:

```text
signal
→ intelligence
→ decision
→ action
→ record
```

---

## recording checklist

```text
[ ] video <= 2:00
[ ] readable zoom level
[ ] no api keys visible
[ ] no dead time
[ ] no long loading screen
[ ] app names visible
[ ] score visible
[ ] approval visible
[ ] gmail result visible
[ ] google sheets row visible
[ ] final thesis stated
```

---

## submission checklist

after recording:

```text
[ ] upload video
[ ] verify public access
[ ] paste real video url into README
[ ] remove README TODO placeholders
[ ] verify github access
[ ] verify setup commands
[ ] verify test counts
[ ] final secret scan
```
