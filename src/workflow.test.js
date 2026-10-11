import test from "node:test";
import assert from "node:assert/strict";
import { botLaunchIdFromPath, createDefaultWorkflow, nodeKinds, workflowPresets } from "./workflow.js";

function assertValidWorkflow(workflow, label) {
  const ids = workflow.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, `${label}: node IDs must be unique`);
  assert.ok(workflow.nodes.some((node) => node.data.kind === "start"), `${label}: needs a start node`);
  assert.ok(workflow.nodes.some((node) => node.data.kind === "fallback"), `${label}: needs a fallback node`);
  for (const node of workflow.nodes) {
    assert.ok(nodeKinds[node.data.kind], `${label}: unknown node kind ${node.data.kind}`);
    assert.equal(node.type, "workflow", `${label}: React Flow nodes must use the workflow type`);
  }
  const idSet = new Set(ids);
  for (const edge of workflow.edges) {
    assert.ok(idSet.has(edge.source), `${label}: edge source ${edge.source} must exist`);
    assert.ok(idSet.has(edge.target), `${label}: edge target ${edge.target} must exist`);
  }
}

test("default workflow has a reachable start path and valid edges", () => {
  const workflow = createDefaultWorkflow();
  assertValidWorkflow(workflow, "default");
  const adjacency = new Map(workflow.nodes.map(({ id }) => [id, []]));
  for (const edge of workflow.edges) adjacency.get(edge.source).push(edge.target);
  const reached = new Set();
  const visit = (id) => {
    if (reached.has(id)) return;
    reached.add(id);
    adjacency.get(id).forEach(visit);
  };
  visit(workflow.nodes.find((node) => node.data.kind === "start").id);
  assert.ok(reached.has("menu"), "new users should reach the main menu");
  assert.ok(workflow.nodes.some((node) => node.id === "fallback"), "a default response must be available for unmatched messages");
});

test("each business preset has valid graph references and starts at its first menu", () => {
  for (const [key, preset] of Object.entries(workflowPresets)) {
    const workflow = preset.build();
    assertValidWorkflow(workflow, key);
    const start = workflow.nodes.find((node) => node.data.kind === "start");
    const startEdge = workflow.edges.find((edge) => edge.source === start.id);
    assert.ok(startEdge, `${key}: start must lead into the scenario`);
    assert.equal(workflow.nodes.find((node) => node.id === startEdge.target).data.kind, "menu", `${key}: first step should be a menu`);
  }
});

test("document preset routes users from the menu to document intake", () => {
  const workflow = workflowPresets.documents.build();
  const menu = workflow.nodes.find((node) => node.data.kind === "menu");
  const intake = workflow.nodes.find((node) => node.data.kind === "document");
  assert.ok(menu && intake, "document preset must include its menu and intake node");
  assert.ok(workflow.edges.some((edge) => edge.source === menu.id && edge.target === intake.id), "document intake must be reachable from the menu");
});

test("launch route parser accepts UUID paths and rejects unrelated or partial paths", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(botLaunchIdFromPath(`/api/bots/${id}/launch`), id);
  assert.equal(botLaunchIdFromPath(`/api/bots/${id}/config`), null);
  assert.equal(botLaunchIdFromPath(`/api/bots/${id.slice(0, -1)}/launch`), null);
});
