# n8n Job Monitor

> A clear, deterministic job-search automation that collects listings, finds relevant roles, avoids duplicates, saves verified records, and reports results to Slack.

[![n8n](https://img.shields.io/badge/built%20with-n8n-EA4B71.svg)](https://n8n.io/) [![Demo](https://img.shields.io/badge/demo-offline%20and%20credential--free-2D6A4F.svg)](docs/demo-guide.md) [![License: MIT](https://img.shields.io/badge/license-MIT-0B7F5C.svg)](LICENSE)

![Five-stage view of the job monitor, from approved feeds to verified Slack results](assets/workflow-overview.svg)

This repository presents the workflow in two ways:

- a visual, nontechnical walkthrough for recruiters and hiring teams;
- an importable n8n demo for technical reviewers who want to try it.

The demo is deliberately separate from the deployed system. It uses fictional job listings, requires no credentials, makes no network requests, writes to no database, and sends no messages.

## Review this project in 3 minutes — no setup required

1. Follow the diagram above from job collection to the verified Slack summary.
2. Read the [plain-English workflow](#the-workflow-in-plain-english) below.
3. Scan the [safety and reliability decisions](#safety-and-reliability-decisions).
4. If useful, open the [architecture notes](docs/architecture.md) for implementation detail.

**Evidence:** the exact public workflow was imported and executed successfully in a disposable, network-disabled n8n 2.29.7 container. See the [verification record](docs/verification.md).

Running n8n is optional. The importable demo exists for reviewers who want hands-on evidence.

## The problem it solves

Job searches become repetitive quickly: the same sites are checked, listings arrive in different formats, duplicates reappear, and promising roles can be lost in browser tabs.

This workflow turns that process into a reviewable pipeline. It handles repeatable collection and organization while leaving applications and career decisions to a person.

## The workflow in plain English

1. **Collect and standardize listings.** Read only approved public job feeds and convert every listing into the same set of fields.
2. **Test safely and find existing jobs.** Preview changes without writing anything, then compare live results with records already in the tracking database.
3. **Choose and save new matches.** Apply fixed, explainable matching rules and skip listings already seen.
4. **Organize and confirm saved jobs.** Group related records, read them back, and stop if the expected records or links are missing.
5. **Send confirmed results to Slack.** Build one concise summary from results that passed the final checks.

A separate error workflow reports failed executions to a dedicated Slack channel. The alert identifies the workflow, execution, and last node reached while keeping detailed errors in the private n8n log.

## What this demonstrates

| Business need | Workflow response |
| --- | --- |
| Listings arrive in inconsistent formats | Normalize them before matching or storage |
| Search criteria should be understandable | Use fixed terms and visible reasons, not an AI black box |
| The same role appears more than once | Create a stable record key and check existing records |
| A database write may only partly succeed | Read saved records back before reporting success |
| Testing should not create real records | Provide a preview path with writes and notifications disabled |
| One broken step should be visible | Route failed executions through a sanitized error workflow |
| Recruiters should understand the system quickly | Use five plain-language sections and a credential-free demo |

## Safety and reliability decisions

- **No AI node is required.** Matching is based on fixed, reviewable rules, so the same inputs produce the same decisions.
- **Preview before live changes.** The production design can exercise collection, formatting, and matching while blocking database writes and notifications.
- **Verify after saving.** A successful request is not treated as proof; records and relationships are read back from the database.
- **Preserve human review state.** Previously reviewed jobs are not silently reset when a listing appears again.
- **Notify only after verification.** The main Slack summary is downstream of the final checks.
- **Sanitize failure alerts.** Operational details remain in private execution logs rather than public or shared chat messages.

## Optional: run the offline n8n demo

The demo uses five fictional listings and one fictional existing record. It should finish with:

- 5 listings collected;
- 3 listings matching the fixed role criteria;
- 1 existing listing skipped;
- 2 new matches shown in the final preview;
- 0 database writes and 0 Slack messages.

### Quick start

1. Open an n8n 2.x instance.
2. Import [`workflows/job-monitor-demo.json`](workflows/job-monitor-demo.json).
3. Open **Job Monitor — Offline Recruiter Demo** and select **Execute workflow**.
4. Select **Build Slack Message Preview** to inspect the final result.

No credential setup is needed. See the [step-by-step demo guide](docs/demo-guide.md) for the node sequence and expected output.

The optional [`workflows/error-handler-demo.json`](workflows/error-handler-demo.json) shows how failure context is reduced to a safe alert preview. It intentionally contains no Slack credential or delivery node.

## Public demo versus deployed workflow

| Area | Public repository | Deployed workflow |
| --- | --- | --- |
| Job data | Fictional fixtures | Approved public job feeds |
| Matching | Fixed example rules | Fixed role-profile rules |
| Existing records | One fictional record key | NocoDB tracking records |
| Database action | Preview only | Save, link, read back, and verify |
| Slack | Message preview only | Verified result and error channels |
| Credentials | None | Stored privately by n8n |
| Infrastructure | None | Private self-hosted services |

The public workflows are newly prepared portfolio artifacts, not raw production exports with values removed. This prevents private endpoints, identifiers, operational settings, and credential references from entering Git history.

## Repository map

```text
assets/
  workflow-overview.svg       Plain-language visual overview
docs/
  architecture.md             Design decisions and reliability boundaries
  demo-guide.md               Optional n8n import walkthrough
  provenance.md               Public/private derivation boundary
  verification.md             Exact checks run against the public artifacts
examples/
  expected-preview.json       Expected final demo result
scripts/
  check-workflows.mjs         Structure, syntax, and privacy checks
workflows/
  job-monitor-demo.json       Offline, credential-free main workflow
  error-handler-demo.json     Sanitized error-message preview
```

## Deliberate limitations

- This is a job monitor and review aid, not an automatic application bot.
- The public demo does not contact job sites, NocoDB, Slack, or any other service.
- The repository does not expose the private hosted n8n editor or production configuration.
- Fixed matching rules are explainable but less flexible than semantic ranking.
- An n8n error workflow can report failed executions, but it cannot report that its own server is completely offline; that requires an independent uptime monitor.
- Production source use still depends on each source's documented access method, terms, and rate limits.

## Security and provenance

The repository contains no credentials, notification destinations, private addresses, database identifiers, production exports, job-search history, or personal application data. See [SECURITY.md](SECURITY.md) and the [provenance statement](docs/provenance.md).

Copyright © 2026 Mark Cruz. Released under the [MIT License](LICENSE).
