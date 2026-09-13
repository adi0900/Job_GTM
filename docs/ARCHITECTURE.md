# MVP Architecture

The MVP is a single thin TypeScript flow with small modules and local JSON storage.

~~~text
Greenhouse
   ↓
simple fetcher
   ↓
normalize job
   ↓
match against capability_profile.json
   ↓
Hermes
   ↓
Gemini API
   ↓
score + generate outreach
   ↓
Slack approval
   ↓
Gmail send / dry run
   ↓
save result
~~~

## Modules

- greenhouse.ts reads a recent job and returns a normalized job object. It is read-only and should be easy to replace with a fixture.
- matcher.ts compares the job with data/capability_profile.json and returns score factors, evidence, and plain-language reasons.
- hermes.ts coordinates the workflow and prepares the recommendation. It is a small orchestration layer, not a general agent platform.
- gemini.ts receives structured job, profile, and match context and returns why the company is a fit, who to contact when available, and grounded outreach.
- slack.ts displays the recommendation and collects explicit approval.
- gmail.ts sends approved outreach when live execution is enabled; otherwise it logs or drafts.
- storage.ts saves the final result in data/results.json.

Gemini must not invent evidence or send email. Hermes must not contain vendor-specific request details.

## Scoring

~~~text
score = capabilityFit × 0.4 + intent × 0.3 + evidence × 0.2 + urgency × 0.1
~~~

Keep the component values and reasons in the result so the recommendation is explainable.

## Runtime and safety

Local development is the default. AWS may host the eventual runtime, but no distributed AWS services are required for the MVP.

~~~env
APP_ENV=development
EXECUTION_MODE=dry_run
~~~

Only an explicitly approved action may proceed to live Gmail sending.

## Non-goals

Do not introduce microservices, queues, event sourcing, generic connector frameworks, multi-tenancy, elaborate memory, production retry systems, broad CRM abstractions, or a full observability/evaluation platform.
