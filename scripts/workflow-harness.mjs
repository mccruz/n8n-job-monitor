import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const supportedNodeTypes = new Set([
  'n8n-nodes-base.code',
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.stickyNote'
]);

export function loadDemoWorkflow() {
  const bundle = JSON.parse(fs.readFileSync(path.join(root, 'workflows/job-monitor-demo.json'), 'utf8'));
  assert.equal(bundle.length, 1, 'demo workflow export must contain one workflow');
  return bundle[0];
}

function cloneItems(items) {
  return structuredClone(items);
}

function assertItems(value, nodeName) {
  assert.ok(Array.isArray(value), `${nodeName} must return an array of items`);
  for (const item of value) {
    assert.ok(item && typeof item === 'object', `${nodeName} returned an invalid item`);
    assert.ok(item.json && typeof item.json === 'object', `${nodeName} returned an item without json`);
  }
}

function validateGraph(workflow) {
  const nodesByName = new Map();
  for (const node of workflow.nodes) {
    assert.equal(supportedNodeTypes.has(node.type), true, `unsupported node type ${node.type} (${node.name})`);
    assert.equal(nodesByName.has(node.name), false, `duplicate node name ${node.name}`);
    nodesByName.set(node.name, node);
  }

  for (const [sourceName, outputs] of Object.entries(workflow.connections ?? {})) {
    assert.equal(nodesByName.has(sourceName), true, `connection source ${sourceName} is missing`);
    const outputNames = Object.keys(outputs);
    assert.deepEqual(outputNames, ['main'], `${sourceName} has unsupported or extra outputs`);
    const branches = outputs.main;
    assert.equal(Array.isArray(branches), true, `${sourceName} main output must be an array`);
    assert.ok(branches.length <= 1, `${sourceName} has branching main outputs`);
    assert.equal(branches.length, 1, `${sourceName} main output must have exactly one branch`);
    if (branches.length === 1) {
      assert.equal(Array.isArray(branches[0]), true, `${sourceName} main branch must be an array`);
      assert.equal(branches[0].length, 1, `${sourceName} main branch must have exactly one target`);
      const target = branches[0][0];
      assert.equal(nodesByName.has(target.node), true, `${sourceName} targets missing node ${target.node}`);
      assert.equal(target.type, 'main', `${sourceName} has unsupported connection type ${target.type}`);
    }
  }
  return nodesByName;
}

/**
 * Execute the connected Code-node path with the small subset of n8n globals
 * used by this offline workflow: $input, $items, and $json.
 */
export async function runWorkflow(workflow, { inputItems = [{ json: {} }], overrides = {} } = {}) {
  const nodesByName = validateGraph(workflow);
  const trigger = workflow.nodes.find(node => node.type === 'n8n-nodes-base.manualTrigger');
  assert.ok(trigger, 'workflow must have a manual trigger');

  const history = new Map();
  const visited = new Set();
  let nodeName = trigger.name;
  let items = cloneItems(inputItems);

  while (nodeName) {
    assert.equal(visited.has(nodeName), false, `workflow path contains a cycle at ${nodeName}`);
    visited.add(nodeName);
    const node = nodesByName.get(nodeName);
    assert.ok(node, `workflow path references missing node ${nodeName}`);

    if (Object.hasOwn(overrides, nodeName)) {
      items = cloneItems(overrides[nodeName]);
    } else if (node.type === 'n8n-nodes-base.code') {
      const source = node.parameters?.jsCode;
      assert.equal(typeof source, 'string', `${nodeName} must contain JavaScript source`);
      const referencedNodes = [...source.matchAll(/\$items\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
      for (const referencedNode of referencedNodes) {
        assert.equal(nodesByName.has(referencedNode), true, `${nodeName} references missing $items node ${referencedNode}`);
        assert.equal(history.has(referencedNode), true, `${nodeName} references unexecuted $items node ${referencedNode}`);
      }
      const input = {
        all: () => items,
        first: () => items[0]
      };
      const getItems = name => {
        assert.equal(nodesByName.has(name), true, `${nodeName} requested missing $items node ${name}`);
        assert.equal(history.has(name), true, `${nodeName} requested unexecuted $items node ${name}`);
        return history.get(name);
      };
      const json = items[0]?.json;
      const execute = new AsyncFunction('$input', '$items', '$json', source);
      items = await execute(input, getItems, json);
    } else if (node.type === 'n8n-nodes-base.manualTrigger') {
      assert.equal(node.name, trigger.name, `unexpected manual trigger ${node.name} in execution path`);
    } else {
      throw new Error(`unsupported node type ${node.type} (${node.name}) in execution path`);
    }

    assertItems(items, nodeName);
    history.set(nodeName, cloneItems(items));
    nodeName = workflow.connections?.[nodeName]?.main?.[0]?.[0]?.node ?? null;
  }

  return { items, history };
}

export function demoListings(listings) {
  return listings.map(listing => ({ json: { ...listing } }));
}

export const baselineExpected = JSON.parse(
  fs.readFileSync(path.join(root, 'examples/expected-preview.json'), 'utf8')
);
