# Demo Flow

## Goal

Show one recent job moving from live signal to approved outreach and saved result.

## Sequence

1. Start Odyva in development dry-run mode.
2. Fetch a recent Greenhouse role.
3. Display when the role was posted.
4. Normalize the job.
5. Load data/capability_profile.json.
6. Match the job against verified capabilities.
7. Calculate the weighted score.
8. Show the score factors and reasons.
9. Ask Gemini to prepare why the company is a fit, who to contact when available, and personalized outreach.
10. Send the recommendation to Slack.
11. Review the approval card.
12. Click approve.
13. Gmail sends the email or performs a dry run.
14. Save the job, score, approval, message, and outcome in data/results.json.

## Expected moment

~~~text
This job was posted 11 hours ago.
Capability match: 92%.
Reasons: outbound systems, TypeScript, automation, and verified evidence.
Outreach prepared.
Approved in Slack.
Email sent or dry-run completed.
Result saved.
~~~

## Demo safety

Use dry-run mode by default. Do not contact a real buyer without explicit approval. A fixture is acceptable if a live Greenhouse result is unavailable during the demo.
