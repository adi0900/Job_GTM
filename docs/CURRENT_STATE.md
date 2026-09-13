# CURRENT_STATE.md

## purpose

this file must describe the real repository as it exists now.

it must not describe the desired architecture as if it already exists.

the first coding agent should inspect the repository and update this file with verified facts.

---

## known hackathon requirements

the project must:

```text
build one useful multi-step ai agent
connect to at least three external apps
show how we know it works
provide an accessible github repo
provide a demo video under two minutes
```

odyva's intended external apps are:

```text
greenhouse
slack
gmail
google sheets
```

---

## known product flow

target mvp:

```text
greenhouse
→ normalize
→ capability match
→ score
→ hermes
→ gemini
→ slack approval
→ gmail
→ google sheets
```

---

## known runtime decisions

```text
hermes = runtime operator
gemini api = primary ai caller
slack = human approval
gmail = approved outbound execution
google sheets = external record
sol + luna = development-only
aws = optional for hackathon demo
```

---

## repository status

the actual codebase state has not been verified inside this document yet.

do not assume any of these already exist:

```text
greenhouse integration
capability matcher
hermes runtime
gemini integration
slack approval
gmail execution
google sheets logging
tests
deployment
```

---

## required first repo scan

before major implementation changes, inspect:

```text
1. top-level tree
2. package manager
3. language/runtime
4. package.json scripts
5. entry point
6. existing hermes code
7. existing gemini code
8. existing greenhouse code
9. existing slack code
10. existing gmail code
11. existing google sheets code
12. persistence
13. tests
14. environment variables
15. working end-to-end behavior
```

---

## update template

replace this section after the real repo scan.

### stack

```text
language:
runtime:
package manager:
framework:
database/storage:
```

### run commands

```text
install:
run:
test:
build:
```

### working

```text
- ...
- ...
```

### partial

```text
- ...
- ...
```

### missing

```text
- ...
- ...
```

### current end-to-end flow

```text
...
```

### external apps verified

```text
greenhouse:
slack:
gmail:
google sheets:
```

### tests

```text
test command:
passing:
failing:
```

### known blockers

```text
- ...
- ...
```

---

## priority order

the coding agent should always work on the first missing part of this chain:

```text
greenhouse
→ normalize
→ match
→ score
→ gemini
→ hermes
→ slack
→ gmail
→ google sheets
```

after the full chain works:

```text
happy path
→ reject path
→ duplicate approval
→ gemini failure
→ gmail failure
→ sheets failure
→ readme completion
→ demo recording
```

---

## readme submission gate

before submission, confirm `README.md` contains:

```text
## 01. Project Overview
## 02. External Apps Used
## 03. Setup Instructions
## 04. Reliability Testing
## 05. Demo Video
```

and that:

```text
setup commands are real
test counts are real
video link is real
no TODO submission placeholders remain
```

---

## rule

do not refactor working code for style while the demo loop is incomplete.

the order is:

```text
working
→ reliable
→ clear
→ polished
```

not:

```text
perfect architecture
→ eventually working
```
