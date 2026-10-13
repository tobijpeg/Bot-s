import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultWorkflow, nodeKinds, workflowPresets } from "./workflow.js";
import { applyWorkflowOperations, classifyBuilderMessage, cleanTemplateDataForGeneratedWorkflow, createAllFeatureWorkflow, createBuilderBaseline, detectWorkflowBusinessType, getBuilderGateReply, getWorkflowClarificationQuestions, isAllFeatureRequest, isBuilderCreationIntent, isGeneratedWorkflowRelevant, isWorkflowCreationRequest, normalizeBuilderClarificationQuestions, normalizeGeneratedNode, relevantBusinessDescription, relevantBusinessName, sanitizeBuilderText, shouldAskBuilderClarification } from "./workflow-ai.js";

const block = (id, kind, title, text, buttonLabel = title) => ({ id, kind, title, text, buttonLabel, keywords: "" });

test("creation requests start from a clean personal flow while explicit edits keep the current flow", () => {
  assert.equal(isWorkflowCreationRequest("Сделай мне сценарий для записи клиентов в мастерскую"), true);
  assert.equal(isWorkflowCreationRequest("Создай бота для кафе и добавь абсолютно все функции в меню"), true);
  assert.equal(isWorkflowCreationRequest("Добавь вопрос о модели оборудования"), false);
  assert.equal(isWorkflowCreationRequest("Новый сценарий для сбора заявок"), true);
  assert.equal(isWorkflowCreationRequest("Привет"), false);
  assert.equal(isWorkflowCreationRequest("Create a bot for my coffee shop"), true);
  assert.equal(isWorkflowCreationRequest("фывыфывы"), false);
  assert.equal(isWorkflowCreationRequest("Нужен бот для моей фотостудии"), true);
  assert.equal(isBuilderCreationIntent("У меня фотостудия, хочу собирать заявки на съёмки"), true);
  assert.equal(isBuilderCreationIntent("Добавь вопрос о модели оборудования"), false);

  const baseline = createBuilderBaseline("Добро пожаловать в мастерскую.");
  assert.equal(baseline.nodes.length, 4);
  assert.ok(baseline.nodes.some((node) => node.id === "welcome" && node.data.text.includes("мастерскую")));
  assert.match(baseline.nodes.find((node) => node.id === "menu").data.text, /чем мы можем помочь/iu);
  assert.ok(baseline.nodes.find((node) => node.id === "menu").data.buttonLabel);
  assert.ok(!baseline.nodes.some((node) => ["catalog", "booking"].includes(node.data.kind)), "the clean starting flow must not contain demo-shop behavior");
});

test("builder filters greet politely and reject unrelated input without treating it as a build request", () => {
  assert.equal(classifyBuilderMessage("Привет!"), "greeting");
  assert.equal(classifyBuilderMessage("Привет, как дела?"), "greeting");
  assert.equal(classifyBuilderMessage("Сәлеметсіз бе"), "greeting");
  assert.equal(classifyBuilderMessage("Hello"), "greeting");
  assert.equal(classifyBuilderMessage("фывыфывы"), "off_topic");
  assert.equal(classifyBuilderMessage("Как сегодня погода?"), "off_topic");
  assert.equal(classifyBuilderMessage("Создай новый сайт"), "off_topic");
  assert.equal(classifyBuilderMessage("фигня", { hasPendingClarification: true }), "off_topic");
  assert.equal(classifyBuilderMessage("WhatsApp, завтра в 17:00", { hasPendingClarification: true }), "builder");
  assert.equal(classifyBuilderMessage("Да", { hasPendingClarification: true }), "builder");
  assert.equal(classifyBuilderMessage("Маникюр и педикюр", { hasPendingClarification: true }), "builder");
  assert.equal(classifyBuilderMessage("Сделай всё, что сам считаешь нужным", { hasPendingClarification: true }), "builder");
  assert.equal(classifyBuilderMessage("А какой фильм посмотреть?", { hasPendingClarification: true }), "off_topic");
  assert.equal(classifyBuilderMessage("Создай бота для фотостудии"), "builder");
  assert.equal(classifyBuilderMessage("Добавь в сценарий шаг с телефоном"), "builder");
  assert.match(getBuilderGateReply("off_topic", "ru"), /только с созданием и настройкой Telegram-ботов/iu);
});

test("creation clarification depends on whether the owner already gave useful workflow details", () => {
  assert.equal(shouldAskBuilderClarification("Создай бота для фотостудии"), true);
  assert.equal(shouldAskBuilderClarification("Сделай бота для кофейни"), true);
  assert.equal(shouldAskBuilderClarification("Сделай бота для кофейни", { description: "Кофейня в Астане" }), true);
  assert.equal(shouldAskBuilderClarification("Создай бота для мастерской: собери модель и описание поломки, потом попроси телефон и отправь заявку владельцу"), false);
  assert.equal(shouldAskBuilderClarification("Создай бота со всеми функциями"), false);
  const delegated = "Сделай бота для кофейни\nОтветы владельца на уточняющие вопросы:\nВопросы: Что должен делать бот?\nОтветы: сделай все что сам считаешь\nРаунд уточнений: 1";
  assert.equal(shouldAskBuilderClarification(delegated), false, "an owner who delegates choices should not be asked the same questions again");
});

test("clarification follow-ups use the owner's answers and avoid repeating the initial pair", () => {
  const firstAnswer = "Сделай бота для кофейни\nОтветы владельца на уточняющие вопросы:\n1. Вопросы: Что должен помочь сделать бот? | Какие данные собрать?\nОтветы: Заказ навынос.\nРаунд уточнений: 1\nВыполни исходную просьбу строго с учётом этих ответов.";
  const followups = getWorkflowClarificationQuestions(firstAnswer, { businessName: "Кофе рядом" });
  assert.equal(followups.length, 2);
  assert.match(followups[0], /телефон|адрес|состав|заказ/iu);
  assert.match(followups[1], /подтверждение|«Входящие»|передаст/iu);
  assert.notEqual(followups[0], getWorkflowClarificationQuestions("Сделай бота для кофейни")[0]);
  assert.equal(shouldAskBuilderClarification(firstAnswer), true);

  const answered = "Сделай бота для кофейни\nОтветы владельца на уточняющие вопросы:\nОтветы: заказ навынос; имя и телефон; передать владельцу во входящие.\nРаунд уточнений: 1";
  assert.equal(shouldAskBuilderClarification(answered), false);
  const noSpecificAnswer = "Сделай бота для кофейни\nОтветы владельца на уточняющие вопросы:\nОтветы: да.\nРаунд уточнений: 1";
  const rephrased = getWorkflowClarificationQuestions(noSpecificAnswer, { businessName: "Кофе рядом" });
  assert.match(rephrased[0], /гост|кофейн|напит|заказ/iu);
  assert.notEqual(rephrased[0], getWorkflowClarificationQuestions("Сделай бота для кофейни")[0]);
  assert.equal(shouldAskBuilderClarification(noSpecificAnswer + "\nРаунд уточнений: 2"), false, "never trap the owner in an endless clarification loop");
  assert.doesNotMatch(getWorkflowClarificationQuestions(noSpecificAnswer, { businessName: "hackathon" }).join(" "), /hackathon/iu, "stale demo names must not leak into questions");
});

test("current business brief wins over stale profile and demo names", () => {
  assert.equal(relevantBusinessName("Сделай бота для кофейни", { businessName: "hackathon" }), "");
  assert.equal(relevantBusinessName("Сделай бота для кофейни", { businessName: "Магазин Альфа" }), "");
  assert.equal(relevantBusinessName("Сделай бота для кофейни", { businessName: "Coffee House", description: "Кофейня в Алматы" }), "Coffee House");
  assert.equal(relevantBusinessDescription("Сделай бота для кофейни", { description: "Профиль hackathon demo" }), "");
  assert.equal(relevantBusinessDescription("Сделай бота для кофейни", { description: "Интернет-магазин одежды" }), "");
  assert.equal(relevantBusinessDescription("Сделай бота для кофейни", { description: "Кофейня в Алматы, напитки навынос" }), "Кофейня в Алматы, напитки навынос");
});

test("new workflow generation rejects stale or unrelated model output for the current business", () => {
  const toWorkflow = (node) => ({ id: node.id, data: { kind: node.kind, title: node.title, text: node.text, buttonLabel: node.buttonLabel } });
  const irrelevant = { nodes: [toWorkflow(block("info", "message", "Hackathon info", "Welcome to the hackathon."))], edges: [] };
  const cafe = { nodes: [toWorkflow(block("menu", "menu", "Меню кофейни", "Выберите напиток или блюдо."))], edges: [] };
  assert.equal(isGeneratedWorkflowRelevant("Сделай бота для кофейни", irrelevant), false);
  assert.equal(isGeneratedWorkflowRelevant("Сделай бота для кофейни", cafe), true);
  assert.equal(isGeneratedWorkflowRelevant("Сделай бота для фотостудии", irrelevant), true, "unknown niches remain flexible");
});

test("clarifying questions prefer the current business request over stale template and description", () => {
  const questions = getWorkflowClarificationQuestions("Создай бота для курсов английского", {
    description: "Кофейня с доставкой",
    template: "Магазин",
  });
  assert.match(questions[0], /обуч|ученик|курс|консультац/iu);
  assert.doesNotMatch(questions[0], /блюд|достав|каталог|товар/iu);
});

test("AI clarification output is sanitized and falls back to relevant questions", () => {
  const questions = normalizeBuilderClarificationQuestions(
    ["Что ученик хочет изучать и к какому результату стремится?", "Укажите телефон для связи с администратором.", "Внутренний JSON API"],
    "Создай бота для онлайн-курсов",
    { locale: "ru" },
  );
  assert.equal(questions.length, 2);
  assert.match(questions[0], /ученик|изучать/iu);
  assert.match(questions[1], /телефон/iu);
  assert.doesNotMatch(questions.join(" "), /JSON|API/iu);
});

test("Telegram bot tokens are redacted before saving or sending builder context", () => {
  const safe = sanitizeBuilderText("Бот создан 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi");
  assert.match(safe, /токен Telegram скрыт/iu);
  assert.doesNotMatch(safe, /123456789:/u);
});

test("all-functions requests include every block kind, reachable through menus with no invented business facts", () => {
  const request = "Создай с нуля демонстрационного бота для сервисного центра в Алматы. Добавь в схему все перечисленные ниже функции.\nУточнения владельца: это тестовое кафе; нужно меню, заказ и бронь столика.";
  assert.equal(isAllFeatureRequest(request), true);
  assert.equal(detectWorkflowBusinessType(request, { template: "Магазин" }), "cafe", "the latest clarification must override an older business type and template");

  const workflow = createAllFeatureWorkflow(request, { businessName: "Сервисный центр", description: "Магазин одежды", template: "Магазин" });
  const kinds = new Set(workflow.nodes.map((node) => node.data.kind));
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  assert.deepEqual([...kinds].sort(), Object.keys(nodeKinds).sort());
  assert.ok(workflow.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)));

  const menus = workflow.nodes.filter((node) => node.data.kind === "menu");
  for (const menu of menus) assert.ok(workflow.edges.filter((edge) => edge.source === menu.id).length <= 8, `${menu.id} must fit Telegram's eight-button limit`);
  const selectableKinds = new Set(workflow.edges.filter((edge) => menus.some((menu) => menu.id === edge.source)).map((edge) => workflow.nodes.find((node) => node.id === edge.target)?.data.kind));
  for (const kind of Object.keys(nodeKinds).filter((kind) => !["start", "fallback"].includes(kind))) assert.ok(selectableKinds.has(kind), `${kind} must be directly available from a menu`);
  const reachable = new Set();
  const visit = (id) => { if (reachable.has(id)) return; reachable.add(id); workflow.edges.filter((edge) => edge.source === id).forEach((edge) => visit(edge.target)); };
  visit("start");
  for (const node of workflow.nodes.filter((item) => item.data.kind !== "fallback")) assert.ok(reachable.has(node.id), `${node.id} must be reachable from /start`);
  assert.ok(workflow.nodes.some((node) => node.data.kind === "fallback"), "the default response is triggered automatically for unmatched messages");

  const copy = workflow.nodes.map((node) => `${node.data.title} ${node.data.text}`).join(" ");
  assert.match(copy, /Меню кафе/iu);
  assert.doesNotMatch(copy, /сервисный центр|одежд|Алматы|\+7|\b\S+@\S+\b|9:00|21:00/iu);
  assert.match(workflow.nodes.find((node) => node.data.kind === "payment").data.text, /недоступна/iu);
});

test("cafe all-features workflow includes separate takeaway, delivery, and table-booking paths", () => {
  const workflow = createAllFeatureWorkflow("Создай с нуля бота для кафе и добавь все функции", {});
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]));
  const menuEdges = workflow.edges.filter((edge) => edge.source === "menu-requests");
  const menuLabels = menuEdges.map((edge) => edge.label);
  assert.ok(menuLabels.some((label) => /навынос/iu.test(label)));
  assert.ok(menuLabels.some((label) => /достав/iu.test(label)));
  assert.ok(menuLabels.some((label) => /столик/iu.test(label)));
  assert.match(byId.get("all-takeaway-order").data.text, /количеств.*время.*телефон/iu);
  assert.match(byId.get("all-delivery-order").data.text, /адрес.*время.*телефон/iu);
  assert.match(byId.get("all-booking").data.text, /число гостей/iu);
});

test("new AI workflows clear only template examples while retaining owner-entered business details", () => {
  const template = { description: "Шаблон магазина", features: ["Каталог"], items: [{ name: "Футболка", price: 1000 }] };
  const cleaned = cleanTemplateDataForGeneratedWorkflow({ description: template.description, features: template.features, items: template.items, contacts: { hours: "Ежедневно, 10:00–20:00", phone: "+7 777 123 45 67", address: "Алматы" }, template });
  assert.equal(cleaned.category, "custom");
  assert.equal(cleaned.description, "");
  assert.deepEqual(cleaned.features, []);
  assert.deepEqual(cleaned.items, []);
  assert.equal(cleaned.contacts.hours, "");
  assert.equal(cleaned.contacts.phone, "+7 777 123 45 67");
  assert.equal(cleaned.contacts.address, "Алматы");
});

test("clarifying questions are personalized to a barbershop and cover the actual booking flow", () => {
  const questions = getWorkflowClarificationQuestions("Сделай бота для записи клиентов", {
    businessName: "Barber House",
    description: "Барбершоп в Астане",
  });
  assert.equal(questions.length, 2);
  assert.match(questions[0], /услуг/iu);
  assert.match(questions[1], /телефон|дат/iu);
  assert.ok(questions.every((question) => !/разработчик|тестировщик|сценарий|JSON/iu.test(question)));
});

test("clarifying questions for a cafe ask about orders and guest details rather than generic setup", () => {
  const questions = getWorkflowClarificationQuestions("Нужен бот для кафе и доставки", { businessName: "Кофе рядом" });
  assert.match(questions[0], /заказ|блюд/iu);
  assert.match(questions[1], /телефон|адрес|врем/iu);
});

test("clarifying questions for education focus on student goals and intake details", () => {
  const questions = getWorkflowClarificationQuestions("Создай бота для онлайн-курса английского");
  assert.match(questions[0], /обуч|ученик|ученик|курс|консультац/iu);
  assert.match(questions[1], /уровен|времен|контакт|подготов/iu);
});

test("the user's stated business takes priority over a previously selected starter template", () => {
  const questions = getWorkflowClarificationQuestions("Создай бота для курсов английского", { template: "Магазин" });
  assert.match(questions[0], /обуч|ученик|курс|консультац/iu);
  assert.doesNotMatch(questions[0], /каталог|товар/iu);
});

test("business clarification questions follow the selected site language", () => {
  assert.match(getWorkflowClarificationQuestions("Create a bot for a barbershop", { locale: "en" })[0], /services|customers/i);
  assert.match(getWorkflowClarificationQuestions("Сұлулық салонына бот керек", { locale: "kk" })[0], /қызметтер|клиентке/iu);
});

test("AI-created blocks receive useful customer copy and button labels when the model omits or emits placeholders", () => {
  const question = normalizeGeneratedNode({ id: "q", kind: "question", title: "Телефон клиента", text: "", buttonLabel: "Далее" }, 0);
  assert.equal(question.data.text, "Напишите ответ одним сообщением, чтобы мы могли продолжить.");
  assert.equal(question.data.buttonLabel, "Телефон клиента");
  assert.ok(question.data.title && question.data.keywords !== undefined);

  const result = applyWorkflowOperations(createBuilderBaseline(), {
    addNodes: [block("service", "question", "Какая услуга нужна?", "Выберите действие", "")],
    updateNodes: [], removeNodes: [], removeEdges: [],
    edges: [{ source: "menu", target: "service", label: "" }],
  });
  const service = result.workflow.nodes.find((node) => node.id === "service");
  assert.equal(service.data.text, "Напишите ответ одним сообщением, чтобы мы могли продолжить.");
  assert.equal(service.data.buttonLabel, "Какая услуга нужна?");
  assert.equal(result.workflow.edges.find((edge) => edge.source === "menu" && edge.target === "service").label, "Какая услуга нужна?");
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
  assert.equal(result.workflow.nodes.find((node) => node.id === "service").data.text, "Напишите, какая услуга вам нужна.", "a free-text question must not promise an unavailable choice list");
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
