import { nodeKinds } from "./workflow.js";
import { randomBytes } from "node:crypto";

const EDIT_REQUEST = /(?:добав|измени|помен|удал|убер|соедини|свяж|переимен|обнов|допол|перенес|отредактир)/iu;
const NEW_WORKFLOW_REQUEST = /(?:с\s+нуля|нов(?:ый|ую|ое|ого)\s+(?:сценар|структур|бот))/iu;

export function isWorkflowCreationRequest(question) {
  const text = String(question || "").trim();
  if (NEW_WORKFLOW_REQUEST.test(text)) return true;
  return !EDIT_REQUEST.test(text);
}

export function createBuilderBaseline(greeting = "Здравствуйте! Расскажите, чем мы можем помочь.") {
  const nodes = [
    { id: "start", type: "workflow", position: { x: 40, y: 220 }, data: { kind: "start", title: "Новый пользователь" } },
    { id: "welcome", type: "workflow", position: { x: 300, y: 220 }, data: { kind: "message", title: "Приветствие", text: String(greeting).slice(0, 1000), buttonLabel: "Начать", keywords: "" } },
    { id: "menu", type: "workflow", position: { x: 560, y: 220 }, data: { kind: "menu", title: "Главное меню", text: "Выберите подходящий пункт", buttonLabel: "Меню", keywords: "" } },
    { id: "fallback", type: "workflow", position: { x: 560, y: 470 }, data: { kind: "fallback", title: "Ответ по умолчанию", text: "Не получилось определить запрос. Выберите пункт меню или напишите подробнее.", buttonLabel: "Помощь", keywords: "" } },
  ];
  const edges = [
    { id: "builder-start-welcome", source: "start", target: "welcome", label: "" },
    { id: "builder-welcome-menu", source: "welcome", target: "menu", label: "" },
  ];
  return { nodes, edges };
}

export function normalizeGeneratedNode(node, index, existingIds = new Set()) {
  if (!node || !nodeKinds[node.kind] || ["start", "fallback"].includes(node.kind)) return null;
  const candidate = String(node.id || "").slice(0, 60);
  const id = candidate && !existingIds.has(candidate) ? candidate : `ai-node-${index + 1}`;
  return {
    id,
    type: "workflow",
    position: { x: 300 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 170 },
    data: {
      kind: node.kind,
      title: String(node.title || nodeKinds[node.kind].title).slice(0, 100),
      text: String(node.text || "").slice(0, 1000),
      buttonLabel: String(node.buttonLabel || node.title || nodeKinds[node.kind].title).slice(0, 60),
      keywords: String(node.keywords || "").slice(0, 250),
    },
  };
}

export function applyWorkflowOperations(baseWorkflow, generated, { wantsDocuments = false } = {}) {
  const baseNodes = Array.isArray(baseWorkflow?.nodes) ? baseWorkflow.nodes : [];
  const baseEdges = Array.isArray(baseWorkflow?.edges) ? baseWorkflow.edges : [];
  const nodes = baseNodes.map((node) => ({ ...node, data: { ...node.data } }));
  const protectedIds = new Set(nodes.filter((node) => ["start", "fallback"].includes(node.data?.kind) || ["welcome", "menu"].includes(node.id)).map((node) => node.id));
  const removedNodeIds = new Set((Array.isArray(generated?.removeNodes) ? generated.removeNodes : []).filter((id) => typeof id === "string" && !protectedIds.has(id)));
  const retained = nodes.filter((node) => !removedNodeIds.has(node.id));
  nodes.splice(0, nodes.length, ...retained);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let updatedCount = 0;
  for (const update of (Array.isArray(generated?.updateNodes) ? generated.updateNodes : []).slice(0, 30)) {
    const node = nodeById.get(update?.id);
    if (!node || node.data.kind === "start") continue;
    let changed = false;
    for (const field of ["title", "text", "buttonLabel", "keywords"]) {
      if (typeof update[field] === "string" && update[field] && update[field] !== node.data[field]) {
        node.data[field] = update[field].slice(0, field === "text" ? 1000 : 250);
        changed = true;
      }
    }
    if (changed) updatedCount += 1;
  }

  const addedIdMap = new Map();
  const addedIds = new Set();
  const existingMenu = nodes.find((item) => item.data.kind === "menu");
  const existingWelcome = nodes.find((item) => item.id === "welcome" || item.data.kind === "message");
  for (const [index, node] of (Array.isArray(generated?.addNodes) ? generated.addNodes : []).slice(0, 12).entries()) {
    if (!node || !nodeKinds[node.kind] || ["start", "fallback"].includes(node.kind)) continue;
    const proposedId = String(node.id || "").slice(0, 60);
    const title = String(node.title || "").trim();
    const normalizedTitle = title.toLocaleLowerCase("ru-RU");
    const alias = existingMenu && ["меню", "главное меню", "навигация"].includes(normalizedTitle)
      ? existingMenu
      : existingWelcome && node.kind === "message" && /^(приветствие|привет|welcome|знакомство|старт)$/i.test(title)
        ? existingWelcome
        : null;
    if (alias) {
      if (proposedId) addedIdMap.set(proposedId, alias.id);
      continue;
    }
    const id = proposedId && !nodeById.has(proposedId) ? proposedId : `ai-${randomBytes(5).toString("hex")}`;
    if (proposedId) addedIdMap.set(proposedId, id);
    const next = {
      id,
      type: "workflow",
      position: { x: 300 + ((nodes.length + index) % 4) * 240, y: 120 + Math.floor((nodes.length + index) / 4) * 170 },
      data: {
        kind: node.kind,
        title: String(node.title || nodeKinds[node.kind].title).slice(0, 100),
        text: String(node.text || "").slice(0, 1000),
        buttonLabel: String(node.buttonLabel || node.title || "").slice(0, 60),
        keywords: String(node.keywords || "").slice(0, 250),
      },
    };
    nodes.push(next);
    nodeById.set(id, next);
    addedIds.add(id);
  }

  const edges = baseEdges
    .filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target) && nodeById.has(edge.source) && nodeById.has(edge.target))
    .map((edge) => ({ ...edge }));
  const removedEdgeIds = new Set(Array.isArray(generated?.removeEdges) ? generated.removeEdges.filter((id) => typeof id === "string") : []);
  const protectedEdgeIds = new Set(baseEdges.filter((edge) => edge.source === "start" || (edge.source === "welcome" && edge.target === "menu")).map((edge) => edge.id));
  for (let index = edges.length - 1; index >= 0; index -= 1) if (removedEdgeIds.has(edges[index].id) && !protectedEdgeIds.has(edges[index].id)) edges.splice(index, 1);

  const addEdge = (source, target, label = "") => {
    const mappedSource = addedIdMap.get(source) || source;
    const mappedTarget = addedIdMap.get(target) || target;
    if (!nodeById.has(mappedSource) || !nodeById.has(mappedTarget) || mappedSource === mappedTarget || edges.some((edge) => edge.source === mappedSource && edge.target === mappedTarget)) return;
    if (["start", "welcome"].includes(mappedSource) || ["start", "welcome"].includes(mappedTarget)) return;
    if (nodeById.get(mappedTarget).data.kind === "start" || nodeById.get(mappedSource).data.kind === "fallback") return;
    edges.push({ id: `edge-${randomBytes(6).toString("hex")}`, source: mappedSource, target: mappedTarget, label: String(label || "").slice(0, 60), type: "default" });
  };
  for (const edge of (Array.isArray(generated?.edges) ? generated.edges : []).slice(0, 40)) addEdge(edge?.source, edge?.target, edge?.label);

  if (wantsDocuments) {
    let documentNode = nodes.find((node) => node.data.kind === "document");
    const menuNode = nodes.find((node) => node.data.kind === "menu");
    if (!documentNode) {
      const id = `document-${randomBytes(4).toString("hex")}`;
      documentNode = { id, type: "workflow", position: { x: 820, y: 120 }, data: { kind: "document", title: "Приём документа", text: "Отправьте документ для рассмотрения.", buttonLabel: "📎 Отправить документ", keywords: "" } };
      nodes.push(documentNode);
      nodeById.set(id, documentNode);
      addedIds.add(id);
    }
    if (menuNode) addEdge(menuNode.id, documentNode.id, documentNode.data.buttonLabel || "Отправить документ");
  }

  const incomingIds = new Set(edges.map((edge) => edge.target));
  const menuNode = nodes.find((node) => node.data.kind === "menu");
  if (menuNode) for (const nodeId of addedIds) {
    if (!incomingIds.has(nodeId)) {
      const node = nodeById.get(nodeId);
      addEdge(menuNode.id, nodeId, node.data.buttonLabel || node.data.title);
    }
  }

  if (!nodes.some((node) => node.data.kind === "start") || !nodes.some((node) => node.data.kind === "fallback")) {
    throw new Error("В схеме должны оставаться блоки /start и ответа по умолчанию.");
  }
  return {
    workflow: { nodes, edges },
    addedCount: Math.max(0, nodes.length - baseNodes.length),
    updatedCount,
    removedCount: removedNodeIds.size,
    changed: JSON.stringify({ nodes, edges }) !== JSON.stringify({ nodes: baseNodes, edges: baseEdges }),
  };
}

