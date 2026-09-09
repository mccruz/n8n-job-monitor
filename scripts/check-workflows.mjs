import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { demoListings, loadDemoWorkflow, runWorkflow } from './workflow-harness.mjs';

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

const behaviorCases = [
  {
    name: 'baseline',
    overrides: {},
    expected
  },
  {
    name: 'duplicate classification',
    overrides: {
      'Fictional Job Listings': demoListings([
        {
          source: 'Demo ATS',
          source_id: 'DEMO-004',
          title: 'n8n Automation Builder',
          company: 'Brightway Studio',
          location: 'Remote',
          description: 'Create automation workflows and support process improvement projects.',
          listed_on: '2026-08-17'
        },
        {
          source: 'Demo ATS',
          source_id: 'DEMO-006',
          title: 'Workflow Automation Specialist',
          company: 'Oak Labs',
          location: 'Remote',
          description: 'Build workflow integration systems.',
          listed_on: '2026-08-15'
        }
      ])
    },
    expected: {
      run_mode: 'offline_preview',
      discovered_count: 2,
      matched_count: 2,
      duplicate_count: 1,
      new_match_count: 1,
      database_write_performed: false,
      slack_message_sent: false,
      new_roles: [{ title: 'Workflow Automation Specialist', company: 'Oak Labs' }],
      slack_message_preview: 'Job Monitor offline preview\n1 new fictional match(es) would be saved and verified.\n• Workflow Automation Specialist — Oak Labs\nNo database write or Slack message was performed.'
    }
  },
  {
    name: 'no-match input',
    overrides: {
      'Fictional Job Listings': demoListings([{
        source: 'Demo ATS',
        source_id: 'DEMO-007',
        title: 'Graphic Designer',
        company: 'Canvas Co',
        location: 'Remote',
        description: 'Create visual assets.',
        listed_on: '2026-08-14'
      }])
    },
    expected: {
      run_mode: 'offline_preview',
      discovered_count: 1,
      matched_count: 0,
      duplicate_count: 0,
      new_match_count: 0,
      database_write_performed: false,
      slack_message_sent: false,
      new_roles: [],
      slack_message_preview: 'Job Monitor offline preview\n0 new fictional match(es) would be saved and verified.\nNo database write or Slack message was performed.'
    }
  },
  {
    name: 'malformed input',
    overrides: {
      'Fictional Job Listings': demoListings([{ source: 'Demo ATS', source_id: 'MALFORMED' }])
    },
    expected: {
      run_mode: 'offline_preview',
      discovered_count: 1,
      matched_count: 0,
      duplicate_count: 0,
      new_match_count: 0,
      database_write_performed: false,
      slack_message_sent: false,
      new_roles: [],
      slack_message_preview: 'Job Monitor offline preview\n0 new fictional match(es) would be saved and verified.\nNo database write or Slack message was performed.'
    }
  }
];

try {
  const workflow = loadDemoWorkflow();
  for (const behaviorCase of behaviorCases) {
    const result = await runWorkflow(workflow, { overrides: behaviorCase.overrides });
    assert.equal(result.items.length, 1, `${behaviorCase.name} must produce one preview item`);
    assert.deepEqual(result.items[0].json, behaviorCase.expected, `${behaviorCase.name} output changed`);
    console.log(`PASS: offline harness ${behaviorCase.name}`);
  }

  const mutationMustFailOutputAssertion = async (name, mutate) => {
    const mutated = structuredClone(workflow);
    mutate(mutated);
    let outputAssertionFailed = false;
    try {
      const result = await runWorkflow(mutated);
      assert.deepEqual(result.items[0].json, expected, `${name} unexpectedly preserved the expected output`);
    } catch {
      outputAssertionFailed = true;
    }
    assert.equal(outputAssertionFailed, true, `${name} mutation was not detected by the output assertion`);
    console.log(`PASS: offline harness detects ${name} regression`);
  };

  await mutationMustFailOutputAssertion('matching-score', mutated => {
    const node = mutated.nodes.find(candidate => candidate.name === 'Apply Fixed Matching Rules');
    node.parameters.jsCode = node.parameters.jsCode.replace('const threshold = 2;', 'const threshold = 0;');
  });
  await mutationMustFailOutputAssertion('duplicate-classification', mutated => {
    const node = mutated.nodes.find(candidate => candidate.name === 'Classify Existing Records');
    node.parameters.jsCode = node.parameters.jsCode.replace("new Set(['demo-ats:DEMO-004'])", "new Set(['demo-ats:DEMO-999'])");
  });

  const harnessMustReject = async (name, mutate, pattern) => {
    const mutated = structuredClone(workflow);
    mutate(mutated);
    await assert.rejects(() => runWorkflow(mutated), pattern, `${name} mutation was accepted by the harness`);
    console.log(`PASS: offline harness rejects ${name}`);
  };

  await harnessMustReject(
    'unsupported node type',
    mutated => {
      mutated.nodes.find(candidate => candidate.name === 'Apply Fixed Matching Rules').type = 'n8n-nodes-base.httpRequest';
    },
    /unsupported node type/
  );
  await harnessMustReject(
    'branching output',
    mutated => {
      mutated.connections['Apply Fixed Matching Rules'].main.push([
        { node: 'Classify Existing Records', type: 'main', index: 0 }
      ]);
    },
    /branching main outputs/
  );
  await harnessMustReject(
    'extra output',
    mutated => {
      mutated.connections['Apply Fixed Matching Rules'].error = [];
    },
    /unsupported or extra outputs/
  );
  await harnessMustReject(
    'missing $items reference',
    mutated => {
      const node = mutated.nodes.find(candidate => candidate.name === 'Build Slack Message Preview');
      node.parameters.jsCode = node.parameters.jsCode.replace("$items('Standardize Listings')", "$items('Missing Node')");
    },
    /references missing \$items node/
  );
} catch (error) {
  fail(`offline harness behavior check failed: ${error.message}`);
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
