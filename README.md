# n8n Job Monitor

An n8n workflow that collects job listings, finds relevant roles with visible
rules, prevents duplicates, verifies saved records, and reports confirmed
results to Slack.

[![n8n](https://img.shields.io/badge/built%20with-n8n-EA4B71.svg)](https://n8n.io/)
[![Demo](https://img.shields.io/badge/demo-offline%20and%20credential--free-2D6A4F.svg)](docs/demo-guide.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-0B7F5C.svg)](LICENSE)

![Five-stage view of the job monitor, from approved feeds to verified Slack results](assets/workflow-overview.svg)

## Review this project in 3 minutes

No setup is required:

1. Follow the diagram from job collection to the Slack summary.
2. Read [How it works](#how-it-works) and
   [Safety and reliability](#safety-and-reliability).
3. Open the [architecture notes](docs/architecture.md),
   [demo guide](docs/demo-guide.md), or
   [verification record](docs/verification.md) for technical detail.

The public workflow was imported and executed in a disposable,
network-disabled n8n container. Running n8n locally is optional.

## The problem

Job searches involve repetitive work: checking the same sources, translating
different listing formats, recognizing duplicates, and keeping promising roles
organized. This workflow automates collection and recordkeeping while leaving
applications and career decisions to a person.

## How it works

1. Collect listings from approved public feeds and give them consistent fields.
2. Preview the run and compare listings with records already in the tracker.
3. Apply fixed matching rules and skip jobs that were seen before.
4. Save new matches, read them back, and confirm that the expected records exist.
5. Send one Slack summary containing only verified results.

A separate error workflow creates a short failure alert. Detailed errors stay
in the private n8n execution log instead of being copied into Slack.

## What this demonstrates

| Need | Workflow response |
| --- | --- |
| Job feeds use different formats | Standardize listings before matching or storage |
| Search rules should be understandable | Use fixed terms and visible match reasons |
| The same role may appear again | Create a stable key and check existing records |
| A save can partly fail | Read records back before reporting success |
| Testing should not change live data | Provide a preview with writes and messages disabled |
| Failures should be visible | Route them through a sanitized error workflow |

## Safety and reliability

- **No AI ranking is required.** The same inputs produce the same matching
  result.
- **Preview before writing.** Collection and matching can be tested without
  creating records or sending notifications.
- **Verify after saving.** A successful request is not accepted as proof that
  every expected record was stored correctly.
- **Preserve human decisions.** A listing that reappears does not silently reset
  its previous review state.
- **Notify after verification.** Slack receives only results that passed the
  final checks.
- **Keep failures concise.** Shared alerts identify where the run stopped while
  private logs retain the detailed error.

## Optional offline demo

The demo uses five fictional listings and one fictional existing record. It
makes no network requests, writes to no database, and sends no Slack messages.

1. Import [`workflows/job-monitor-demo.json`](workflows/job-monitor-demo.json)
   into n8n 2.x.
2. Open **Job Monitor — Offline Recruiter Demo**.
3. Select **Execute workflow**.
4. Inspect **Build Slack Message Preview**.

The expected preview shows five collected listings, three matches, one existing
listing skipped, two new matches, and zero live actions. See the
[demo guide](docs/demo-guide.md) for the node sequence and expected output.

## Public demo boundary

| Public repository | Deployed workflow |
| --- | --- |
| Fictional job fixtures | Approved public job feeds |
| Example matching rules | Private role-profile rules |
| Preview only | Save, link, read back, and verify |
| No credentials or messages | Private n8n credentials and Slack delivery |

The public artifacts were prepared specifically for review. They contain no
private endpoints, identifiers, production exports, job-search history, or
application data.

## Limitations

- This is a monitor and review aid, not an automatic application bot.
- Fixed matching rules are clear but less flexible than semantic matching.
- The public demo does not contact job sites, NocoDB, Slack, or another service.
- Source availability still depends on each provider's access rules and rate
  limits.
- An n8n error workflow cannot report that its own server is completely offline;
  an independent uptime monitor is needed for that case.

## Project guide

- [Architecture](docs/architecture.md)
- [Offline demo](docs/demo-guide.md)
- [Verification record](docs/verification.md)
- [Security policy](SECURITY.md)
- [Public/private boundary](docs/provenance.md)
- [Expected preview](examples/expected-preview.json)

Copyright © 2026 Mark Cruz. Released under the [MIT License](LICENSE).
