# Offline demo guide

The demo is designed for optional technical review. Recruiters can understand the project from the main README without installing anything.

## What you need

- an n8n 2.x instance;
- permission to import an inactive workflow.

You do not need a Slack account, database, API key, job-site account, or internet connection during execution.

## Import and run

1. Download [`job-monitor-demo.json`](../workflows/job-monitor-demo.json).
2. In n8n, select **Import from File** and choose the downloaded file.
3. Open **Job Monitor — Offline Recruiter Demo**.
4. Select **Execute workflow**.
5. Select the final node, **Build Slack Message Preview**.

The final output should match [`expected-preview.json`](../examples/expected-preview.json): five fictional listings, three fixed-rule matches, one duplicate, and two new matches.

## What each section shows

1. **Collect and standardize** creates fictional listings and gives them a consistent shape.
2. **Apply fixed matching rules** records the terms responsible for each decision.
3. **Classify existing records** uses a fictional stable key to identify one duplicate.
4. **Prepare verified preview** labels the records that a live workflow would attempt to save.
5. **Build Slack message preview** creates the summary without contacting Slack.

## Optional error-message preview

Import [`error-handler-demo.json`](../workflows/error-handler-demo.json) to inspect the sanitized alert shape. It starts with an n8n Error Trigger and produces preview text only.

To connect it for your own local experiment, select it as the **Error workflow** in the main demo's workflow settings. Do not add a real Slack node unless you control the destination and intend to send a test.

## Safe cleanup

Both workflows import as inactive and contain no credentials or external operations. Delete them from your n8n instance when you finish reviewing them; there is no database or message cleanup to perform.
