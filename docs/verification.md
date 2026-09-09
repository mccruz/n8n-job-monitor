# Verification record

The n8n container run below is historical evidence from 2026-08-21. The
expanded offline checker was verified locally on 2026-09-09 using Node.js
22.23.1; n8n itself was not rerun for that update.

## Runtime verification

The main workflow and error-handler preview were imported into a disposable n8n 2.29.7 environment with Docker networking disabled. The environment used its own temporary database and was removed after the checks.

The main workflow completed successfully through **Build Slack Message Preview**. Its recorded preview counts were:

- 5 fictional listings discovered;
- 3 fixed-rule matches;
- 1 fictional existing record;
- 2 new preview records;
- no database write;
- no Slack message.

The error-handler preview imported successfully. It was not connected to a live failure or notification destination because the public artifact intentionally contains neither.

## Repository checks

`node scripts/check-workflows.mjs` verifies:

- valid workflow JSON;
- inactive import state;
- unique node names and identifiers;
- valid connection targets;
- JavaScript syntax for every Code node;
- execution of the connected Code-node path with offline `$input`, `$items`, and `$json` mocks;
- baseline comparison with [`expected-preview.json`](../examples/expected-preview.json), plus duplicate, no-match, and malformed-input scenarios;
- rejection of unsupported node types, branching or extra outputs, missing `$items` references, and in-memory matching or duplicate-classification regressions;
- absence of credential fields, notification destinations, private network addresses, Tailscale addresses, and external URLs in workflow files;
- the documented offline-output contract, including matching scores and duplicate counts.

The architecture SVG also passes XML validation. A final public-release review should repeat the repository-wide secret scan, Git-history scan, local-link check, and signed-out GitHub inspection immediately before and after publication.
