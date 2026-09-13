# Current State

## Scope

The repository is now scoped to the hackathon MVP.

The target path is:

~~~text
Greenhouse → normalize → match → Hermes → Gemini → Slack approval → Gmail dry run/send → JSON result
~~~

## Present repository

Control documents:

- AGENTS.md
- README.md
- docs/VISION.md
- docs/ARCHITECTURE.md
- docs/CURRENT_STATE.md
- docs/DEMO_FLOW.md

Implementation scaffold:

- src/index.ts
- src/greenhouse.ts
- src/matcher.ts
- src/hermes.ts
- src/gemini.ts
- src/slack.ts
- src/gmail.ts
- src/storage.ts
- data/capability_profile.json
- data/results.json
- tests/flow.test.ts
- .env.example
- package.json
- tsconfig.json

The implementation files are placeholders until the MVP flow is built.

## Not built yet

- Greenhouse fetching and fixtures
- job normalization
- capability profile data
- deterministic matching and scoring
- Hermes orchestration
- Gemini integration
- Slack approval flow
- Gmail dry run/send
- result persistence
- end-to-end verification

## Next implementation sequence

1. Add a small capability profile fixture.
2. Add a Greenhouse fixture or read-only fetcher.
3. Normalize one job shape.
4. Implement explainable matching.
5. Add Gemini output behind one small provider function.
6. Add Slack approval handling.
7. Add Gmail dry run.
8. Save the result.
9. Verify the entire flow with tests.

Keep the implementation local and small. Do not add production infrastructure or abstractions until the complete demo works.
