import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowFiles = [
  'workflows/job-monitor-demo.json',
  'workflows/error-handler-demo.json',
];

const forbiddenPatterns = [
  { label: 'Slack channel identifier', pattern: /\bC[A-Z0-9]{10}\b/ },
  { label: 'Slack token', pattern: /\bxox(?:a|b|p|r|s)-[A-Za-z0-9-]+\b/ },
  { label: 'private IPv4 address', pattern: /\b(?:10\.|127\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}/ },
  { label: 'Tailscale address', pattern: /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/ },
  { label: 'credential field', pattern: /"credentials"\s*:/ },
  { label: 'Telegram destination', pattern: /"chatId"\s*:/ },
  { label: 'external URL in workflow', pattern: /https?:\/\//i },
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

for (const relativePath of workflowFiles) {
  const absolutePath = path.join(root, relativePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');

  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(raw)) fail(`${relativePath} contains a forbidden ${label}`);
  }

  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    continue;
  }

  if (!Array.isArray(bundle) || bundle.length !== 1) {
    fail(`${relativePath} must contain exactly one exported workflow`);
    continue;
  }

  const workflow = bundle[0];
  if (workflow.active !== false) fail(`${relativePath} must import as inactive`);
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length < 2) {
    fail(`${relativePath} has too few nodes`);
    continue;
  }

  const names = new Set();
  const ids = new Set();
  for (const node of workflow.nodes) {
    if (!node.name || names.has(node.name)) fail(`${relativePath} has a missing or duplicate node name`);
    if (!node.id || ids.has(node.id)) fail(`${relativePath} has a missing or duplicate node id`);
    names.add(node.name);
    ids.add(node.id);

    if (node.type === 'n8n-nodes-base.code') {
      const source = node.parameters?.jsCode;
      if (typeof source !== 'string' || !source.trim()) {
        fail(`${relativePath} code node ${node.name} has no source`);
      } else {
        try {
          new Function(source);
        } catch (error) {
          fail(`${relativePath} code node ${node.name} has invalid JavaScript: ${error.message}`);
        }
      }
    }
  }

  for (const [sourceName, outputTypes] of Object.entries(workflow.connections ?? {})) {
    if (!names.has(sourceName)) fail(`${relativePath} connection source ${sourceName} is missing`);
    for (const branches of Object.values(outputTypes)) {
      for (const branch of branches) {
        for (const edge of branch) {
          if (!names.has(edge.node)) fail(`${relativePath} connection target ${edge.node} is missing`);
        }
      }
    }
  }

  console.log(`PASS: ${relativePath} (${workflow.nodes.length} nodes)`);
}

const expected = JSON.parse(fs.readFileSync(path.join(root, 'examples/expected-preview.json'), 'utf8'));
if (
  expected.discovered_count !== 5 ||
  expected.matched_count !== 3 ||
  expected.duplicate_count !== 1 ||
  expected.new_match_count !== 2 ||
  expected.database_write_performed !== false ||
  expected.slack_message_sent !== false
) {
  fail('examples/expected-preview.json no longer matches the documented offline scenario');
} else {
  console.log('PASS: expected offline preview contract');
}

const markdownFiles = [
  'README.md',
  'SECURITY.md',
  'docs/architecture.md',
  'docs/demo-guide.md',
  'docs/provenance.md',
  'docs/verification.md',
];
for (const relativePath of markdownFiles) {
  const absolutePath = path.join(root, relativePath);
  const markdown = fs.readFileSync(absolutePath, 'utf8');
  for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].trim();
    if (!target || target.startsWith('#') || /^[a-z]+:/i.test(target)) continue;
    const filePart = target.split('#', 1)[0];
    const resolved = path.resolve(path.dirname(absolutePath), decodeURIComponent(filePart));
    if (!fs.existsSync(resolved)) fail(`${relativePath} links to missing file ${target}`);
  }
}
console.log(`PASS: ${markdownFiles.length} Markdown files have valid local links`);

if (process.exitCode) process.exit(process.exitCode);
console.log('All workflow checks passed.');
