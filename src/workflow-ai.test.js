import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultWorkflow, workflowPresets } from "./workflow.js";
import { applyWorkflowOperations, createBuilderBaseline, isWorkflowCreationRequest } from "./workflow-ai.js";

const block = (id, kind, title, text, buttonLabel = title) => ({ id, kind, title, text, buttonLabel, keywords: "" });

test("creation requests start from a clean personal flow while explicit edits keep the current flow", () => {
  assert.equal(isWorkflowCreationRequest("Сделай мне сценарий для записи клиентов в мастерскую"), true);
  assert.equal(isWorkflowCreationRequest("Добавь вопрос о модели оборудования"), false);
  assert.equal(isWorkflowCreationRequest("Новый сценарий для сбора заявок"), true);

  const baseline = createBuilderBaseline("Добро пожаловать в мастерскую.");
  assert.equal(baseline.nodes.length, 4);
  assert.ok(baseline.nodes.some((node) => node.id === "welcome" && node.data.text.includes("мастерскую")));
  assert.ok(!baseline.nodes.some((node) => ["catalog", "booking"].includes(node.data.kind)), "the clean starting flow must not contain demo-shop behavior");
});

test("AI operations create a reachable custom lead workflow directly in the editor graph", () => {
  const base = createBuilderBaseline();
  const generated = {
    answer: "Настроил запись клиентов.",
    addNodes: [
      block("service", "question", "Выбор услуги", "Напишите, какая услуга вам нужна."),
      block("phone", "question", "Контактный телефон", "Оставьте номер телефона для подтверждения записи."),
      block("request", "booking", "Заявка на запись", "Заявка будет доступна владельцу во входящих."),
    ],
    updateNodes: [],
    removeNodes: [],
    removeEdges: [],
    edges: [
      { source: "menu", target: "service", label: "Записаться" },
      { source: "service", target: "phone", label: "Далее" },
      { source: "phone", target: "request", label: "Отправить заявку" },
    ],
  };

  const result = applyWorkflowOperations(base, generated);
  const nodeIds = new Set(result.workflow.nodes.map((node) => node.id));
  assert.ok(result.changed);
  assert.equal(result.addedCount, 3);
  assert.ok(result.workflow.nodes.some((node) => node.data.kind === "start"));
  assert.ok(result.workflow.nodes.some((node) => node.data.kind === "fallback"));
  assert.ok(!result.workflow.nodes.some((node) => node.data.kind === "catalog"));
  assert.ok(result.workflow.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)));
  for (const id of ["welcome", "menu", "service", "phone", "request"]) assert.ok(nodeIds.has(id));
  assert.ok(result.workflow.edges.some((edge) => edge.source === "phone" && edge.target === "request"));
});

test("model-created greeting/menu aliases cannot break the required /start route", () => {
  const result = applyWorkflowOperations(createBuilderBaseline(), {
    addNodes: [
      block("ai-greeting", "message", "Приветствие", "Добро пожаловать!"),
      block("ai-menu", "message", "Меню", "Выберите действие."),
      block("booking", "booking", "Запись", "Напишите желаемую дату."),
    ],
    updateNodes: [], removeNodes: [], removeEdges: [],
    edges: [
      { source: "start", target: "ai-greeting", label: "" },
      { source: "ai-greeting", target: "ai-menu", label: "" },
      { source: "ai-menu", target: "booking", label: "Запись" },
      { source: "booking", target: "start", label: "Сначала" },
    ],
  });
  const startEdges = result.workflow.edges.filter((edge) => edge.source === "start");
  assert.deepEqual(startEdges.map((edge) => edge.target), ["welcome"]);
  assert.ok(result.workflow.edges.some((edge) => edge.source === "menu" && edge.target === "booking"));
  assert.equal(result.workflow.nodes.filter((node) => node.data.kind === "menu").length, 1);
  assert.equal(result.workflow.nodes.filter((node) => node.data.kind === "message" && /приветствие/i.test(node.data.title)).length, 1);
});

test("core greeting and menu path survive model attempts to remove or bypass them", () => {
  const base = createBuilderBaseline();
  const result = applyWorkflowOperations(base, {
    addNodes: [block("book", "booking", "Запись", "Оставьте заявку.")],
    updateNodes: [], removeNodes: ["start", "welcome", "menu", "fallback"],
    removeEdges: base.edges.map((edge) => edge.id),
    edges: [{ source: "start", target: "book", label: "Записаться" }, { source: "menu", target: "book", label: "Запись" }],
  });
  assert.ok(result.workflow.nodes.some((node) => node.id === "welcome"));
  assert.ok(result.workflow.nodes.some((node) => node.id === "menu"));
  assert.ok(result.workflow.nodes.some((node) => node.id === "fallback"));
  assert.ok(result.workflow.edges.some((edge) => edge.source === "start" && edge.target === "welcome"));
  assert.ok(result.workflow.edges.some((edge) => edge.source === "welcome" && edge.target === "menu"));
  assert.ok(!result.workflow.edges.some((edge) => edge.source === "start" && edge.target === "book"));
  assert.ok(result.workflow.edges.some((edge) => edge.source === "menu" && edge.target === "book"));
});

test("document requests reliably create and connect the document intake block", () => {
  const result = applyWorkflowOperations(createBuilderBaseline(), {
    addNodes: [], updateNodes: [], removeNodes: [], removeEdges: [], edges: [],
  }, { wantsDocuments: true });
  const documentNode = result.workflow.nodes.find((node) => node.data.kind === "document");
  assert.ok(documentNode);
  assert.ok(result.workflow.edges.some((edge) => edge.source === "menu" && edge.target === documentNode.id));
});

test("a one-choice booking menu is corrected into a direct main-menu branch", () => {
  const result = applyWorkflowOperations(workflowPresets.feedback.build(), {
    addNodes: [
      block("appointment-menu", "menu", "Записаться на услугу", "Выберите действие.", "Записаться на услугу"),
      block("service", "question", "Какая услуга нужна?", "Выберите услугу из списка:"),
      block("datetime", "question", "Желаемая дата и время", "Укажите дату и время записи."),
      block("client-details", "question", "Имя и номер телефона", "Введите имя и номер телефона."),
      block("confirmation", "message", "Подтверждение записи", "Спасибо! Заявка отправлена."),
      block("contacts", "contacts", "Контакты компании", "Контакты компании"),
    ],
    updateNodes: [], removeNodes: [], removeEdges: [],
    edges: [
      { source: "news", target: "appointment-menu", label: "Записаться на услугу" },
      { source: "appointment-menu", target: "service", label: "Выбрать услугу" },
      { source: "service", target: "datetime", label: "Указать дату и время" },
      { source: "datetime", target: "client-details", label: "Отправить данные" },
      { source: "client-details", target: "confirmation", label: "Подтвердить запись" },
      { source: "confirmation", target: "contacts", label: "Показать контакты" },
    ],
  });
  const nodeIds = new Set(result.workflow.nodes.map((node) => node.id));
  const edgePairs = new Set(result.workflow.edges.map((edge) => `${edge.source}->${edge.target}`));

  assert.ok(!nodeIds.has("appointment-menu"), "a single-action menu should not be an extra nested menu");
  assert.ok(edgePairs.has("loyalty->service"), "booking should be a button on the existing main menu");
  assert.ok(!edgePairs.has("news->appointment-menu"), "booking must not be nested under the unrelated news branch");
  assert.ok(edgePairs.has("loyalty->review") && edgePairs.has("loyalty->news"), "existing review and news choices must remain");
  assert.ok(edgePairs.has("service->datetime") && edgePairs.has("datetime->client-details"));
  assert.ok(edgePairs.has("client-details->confirmation") && edgePairs.has("confirmation->contacts"));
  assert.ok(result.workflow.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)));

  const repairedSavedFlow = applyWorkflowOperations(result.workflow, {
    addNodes: [], updateNodes: [], removeNodes: [], removeEdges: [], edges: [],
  });
  const repairedNodeIds = new Set(repairedSavedFlow.workflow.nodes.map((node) => node.id));
  const repairedEdges = new Set(repairedSavedFlow.workflow.edges.map((edge) => `${edge.source}->${edge.target}`));
  assert.ok(!repairedNodeIds.has("appointment-menu"), "a previously saved misplaced one-button menu should also be repairable");
  assert.ok(repairedEdges.has("loyalty->service"));
  assert.ok(repairedEdges.has("loyalty->review") && repairedEdges.has("loyalty->news"));
});

test("requested removals prune dangling connections but preserve start and fallback", () => {
  const current = createDefaultWorkflow();
  const result = applyWorkflowOperations(current, {
    addNodes: [], updateNodes: [], removeNodes: ["booking", "start", "fallback"], removeEdges: [], edges: [],
  });
  const ids = new Set(result.workflow.nodes.map((node) => node.id));
  assert.ok(!ids.has("booking"));
  assert.ok(ids.has("start") && ids.has("fallback"));
  assert.ok(result.workflow.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
  assert.equal(result.removedCount, 1);
});
