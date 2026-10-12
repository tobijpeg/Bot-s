import { nodeKinds } from "./workflow.js";

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const EDIT_REQUEST = /(?:добав|измени|помен|удал|убер|соедини|свяж|переимен|обнов|допол|перенес|отредактир)/iu;
const NEW_WORKFLOW_REQUEST = /(?:с\s+нуля|нов(?:ый|ую|ое|ого)\s+(?:сценар|структур|бот))/iu;

function normalizeQuestionText(text) {
  const value = String(text || "").slice(0, 1000);
  const hasChoices = /(?:^|\n)\s*(?:[•*-]|\d+[.)])\s*\S/m.test(value);
  if (!hasChoices && /выберите.{0,60}(?:из списка|услуг(?:у|и))/iu.test(value)) return "Напишите, какая услуга вам нужна.";
  return value;
}

export function isWorkflowCreationRequest(question) {
  const text = String(question || "").trim();
  if (NEW_WORKFLOW_REQUEST.test(text)) return true;
  return !EDIT_REQUEST.test(text);
}

const BUSINESS_TYPES = [
  {
    match: /(?:салон|сұлулық|шаштараз|маникюр|педикюр|парикмах|бров|қас|ресниц|кірпік|косметолог|beauty|barber|барбер)/iu,
    questions: {
      ru: ["Какие услуги стоит предложить клиенту в первую очередь? Если перечня услуг пока нет, бот может попросить описать нужную услугу своими словами.", "Как удобнее принимать запись: собрать имя, телефон и пожелание по дате/времени, чтобы вы подтвердили её позже, или сначала уточнить услугу и только потом контакты?"],
      kk: ["Клиентке алдымен қандай қызметтерді ұсыну керек? Қызметтер тізімі болмаса, бот клиенттен қажетті қызметті өз сөзімен жазуды сұрай алады.", "Жазылуды қалай қабылдаймыз: атыңызды, телефонды және қалаған күн/уақытты жинап, кейін растау керек пе, әлде алдымен қызметті нақтылаймыз ба?"],
      en: ["Which services should customers see first? If you do not have a service list yet, the bot can ask customers to describe what they need.", "How should booking work: collect a name, phone number and preferred date/time for you to confirm, or ask which service they need first?"],
    },
  },
  {
    match: /(?:кафе|кофейн|кофехана|ресторан|мейрамхана|пекарн|наубайхана|кондитер|пицц|доставк|жеткізу|еда|тағам|столов|асхана)/iu,
    questions: {
      ru: ["Что должен помочь сделать бот: выбрать блюда, забронировать столик, узнать график/адрес или оставить вопрос заведению?", "Для заказа или брони какие данные важно собрать у гостя — например, состав заказа, время, число гостей, телефон или адрес доставки?"],
      kk: ["Бот қонаққа не істеуге көмектесуі керек: тағам таңдау, үстел брондау, жұмыс уақытын/мекенжайды білу немесе сұрақ жіберу ме?", "Тапсырыс не брондау үшін қандай мәлімет қажет: тапсырыс құрамы, уақыт, қонақ саны, телефон немесе жеткізу мекенжайы?"],
      en: ["What should the bot help guests do: choose dishes, book a table, check hours/address, or send the business a question?", "For an order or booking, what should it collect, such as items, time, party size, phone number or delivery address?"],
    },
  },
  {
    match: /(?:магазин|дүкен|товар|каталог|продаж|сату|одежд|киім|обув|аяқ киім|косметик|маркетплейс|shop)/iu,
    questions: {
      ru: ["Что клиент должен сделать в боте: посмотреть каталог, уточнить наличие или отправить заявку на заказ? Какие товары/категории уже известны?", "Какие данные нужны для обработки заказа: выбранный товар, имя, телефон, город/адрес или предпочтительный способ связи?"],
      kk: ["Клиент ботта не істегені дұрыс: каталогты көру, тауардың бар-жоғын сұрау немесе тапсырысқа өтінім жіберу ме? Қандай тауарлар/санаттар белгілі?", "Тапсырысты өңдеу үшін қандай дерек керек: тауар, аты-жөні, телефон, қала/мекенжай немесе байланыс тәсілі?"],
      en: ["What should customers do in the bot: browse a catalog, ask about availability, or submit an order request? Which products or categories do you already have?", "What details do you need to process an order: item, name, phone, city/address, or preferred way to contact them?"],
    },
  },
  {
    match: /(?:курс|обуч|оқыту|мектеп|школ|репетитор|урок|сабақ|вебинар|образован|білім|ученик|оқушы|студент)/iu,
    questions: {
      ru: ["Кому предназначено обучение и какой следующий шаг вы ждёте от ученика: выбрать курс, записаться на консультацию или оставить заявку?", "Что нужно узнать до связи с учеником — направление, уровень подготовки, удобное время и контакт?"],
      kk: ["Оқу кімге арналған және оқушының келесі қадамы қандай: курс таңдау, кеңеске жазылу немесе өтінім қалдыру ма?", "Оқушымен байланысу үшін нені білу керек: бағыты, дайындық деңгейі, ыңғайлы уақыты және байланыс деректері ме?"],
      en: ["Who is the course for, and what should learners do next: choose a course, book a consultation, or submit an enquiry?", "What should you learn before contacting them: subject, current level, preferred time, and contact details?"],
    },
  },
  {
    match: /(?:ремонт|жөндеу|автосервис|сервисный центр|мастерск|шеберхана|оборудован|жабдық|техник|техника|сантехник|электрик)/iu,
    questions: {
      ru: ["С какой проблемой или услугой чаще всего обращаются клиенты? Нужно ли просить описать неисправность или выбрать тип услуги?", "Какие сведения помогут принять заявку: модель/объект, описание проблемы, адрес, телефон или фото/документ?"],
      kk: ["Клиенттер көбіне қандай мәселе немесе қызмет бойынша жүгінеді? Ақауды сипаттауды сұрау керек пе, әлде қызмет түрін таңдату керек пе?", "Өтінімге қандай дерек қажет: құрылғы/нысан үлгісі, мәселе сипаттамасы, мекенжай, телефон немесе фото/құжат па?"],
      en: ["What problems or services do customers ask about most? Should the bot ask them to describe an issue or choose a service type?", "What details help you handle a request: item/model, issue description, address, phone, or a photo/document?"],
    },
  },
  {
    match: /(?:клиник|стоматолог|врач|дәрігер|медицин|денсаулық|здоров|аптек|дәріхана)/iu,
    questions: {
      ru: ["Какой первый шаг нужен пациенту: выбрать направление, запросить обратный звонок или оставить пожелание по записи?", "Какие контактные данные и предпочтения по времени нужно собрать? Не включайте в бот медицинские диагнозы или чувствительные подробности."],
      kk: ["Пациенттің алғашқы қадамы қандай: бағыт таңдау, кері қоңырау сұрау немесе қабылдауға ыңғайлы уақытты қалдыру ма?", "Қандай байланыс деректері мен уақыт қалауын жинау керек? Ботқа диагноздар мен құпия медициналық мәліметтерді қоспаңыз."],
      en: ["What is the right first step for a patient: choose a department, request a callback, or share a preferred appointment time?", "Which contact details and time preferences should the bot collect? Do not include diagnoses or sensitive medical details."],
    },
  },
];

export function getWorkflowClarificationQuestions(question, context = {}) {
  const request = String(question || "").trim();
  const businessContext = [request, context.description, context.businessName].filter(Boolean).join(" ");
  const businessType = BUSINESS_TYPES.find(({ match }) => match.test(businessContext))
    || BUSINESS_TYPES.find(({ match }) => match.test(String(context.template || "")));
  const locale = ["kk", "en"].includes(context.locale) ? context.locale : "ru";
  if (businessType) return businessType.questions[locale];
  return {
    ru: ["Какую главную задачу клиент должен решить через бота — получить консультацию, оставить заявку, записаться, оформить заказ или что-то другое?", "Какие 2–3 сведения нужно собрать, и что должно произойти после отправки: показать подтверждение, передать обращение вам во «Входящие» или предложить следующий шаг?"],
    kk: ["Клиент бот арқылы қандай негізгі міндетті орындауы керек: кеңес алу, өтінім қалдыру, жазылу, тапсырыс беру немесе басқа әрекет пе?", "Қандай 2–3 мәліметті жинау керек және жауаптан кейін не болсын: растау көрсету, өтінімді сіздің «Кіріс» бөліміне жіберу немесе келесі қадамды ұсыну ма?"],
    en: ["What main task should customers complete with the bot: get advice, submit a request, book, place an order, or something else?", "Which 2–3 details should it collect, and what should happen next: show confirmation, send the request to your Inbox, or offer another step?"],
  }[locale];
}

const NODE_COPY = {
  message: { text: "Расскажите клиенту, как вы можете помочь, и пригласите выбрать следующий шаг.", buttonLabel: "Узнать подробнее" },
  menu: { text: "Выберите подходящий вариант — я подскажу, что делать дальше.", buttonLabel: "Открыть меню" },
  catalog: { text: "Посмотрите доступные товары или услуги и выберите то, что вам подходит.", buttonLabel: "Посмотреть варианты" },
  document: { text: "Прикрепите документ или фото, которое нужно передать на рассмотрение.", buttonLabel: "📎 Отправить документ" },
  booking: { text: "Оставьте пожелания по услуге и времени. Мы свяжемся с вами, чтобы подтвердить запись.", buttonLabel: "Оставить заявку" },
  question: { text: "Напишите ответ одним сообщением, чтобы мы могли продолжить.", buttonLabel: "Ответить" },
  condition: { text: "Выберите подходящий вариант, чтобы перейти к нужному шагу.", buttonLabel: "Выбрать вариант" },
  delay: { text: "Спасибо! Подождите немного, пока мы подготовим следующий шаг.", buttonLabel: "Продолжить" },
  notification: { text: "Отправьте обращение, чтобы передать его ответственному сотруднику.", buttonLabel: "Передать обращение" },
  link: { text: "Откройте страницу по ссылке, чтобы продолжить.", buttonLabel: "Открыть страницу" },
  location: { text: "Поделитесь геопозицией, если хотите, чтобы мы учли ваше местоположение.", buttonLabel: "Отправить геопозицию" },
  contacts: { text: "Здесь вы найдёте способы связаться с компанией.", buttonLabel: "Связаться" },
  keyword: { text: "Напишите, что именно вы ищете, или выберите подходящий раздел.", buttonLabel: "Найти ответ" },
  fallback: { text: "Не получилось распознать запрос. Выберите пункт меню или напишите, чем мы можем помочь.", buttonLabel: "Получить помощь" },
  handoff: { text: "Ваш вопрос передан специалисту. Мы ответим вам в этом чате.", buttonLabel: "Написать специалисту" },
  payment: { text: "Перейдите по ссылке, чтобы оплатить выбранный вариант.", buttonLabel: "Перейти к оплате" },
  feedback: { text: "Оцените ваш опыт и расскажите, что было удобно или что стоит улучшить.", buttonLabel: "Оставить отзыв" },
  subscribe: { text: "Подпишитесь, если хотите получать новости и полезные обновления компании.", buttonLabel: "Получать новости" },
};

function isGenericCopy(value) {
  return /^(?:настройте(?: текст)?(?: этого блока)?|напишите текст|текст блока|выберите действие|выберите пункт|сообщение|введите текст|кнопка|далее|дальше|продолжить|следующий шаг|ок|ok)$/iu.test(String(value || "").trim());
}

function completeNodeCopy(kind, node = {}) {
  const defaults = NODE_COPY[kind] || NODE_COPY.message;
  const title = String(node.title || nodeKinds[kind]?.title || "Шаг").trim();
  const text = String(node.text || "").trim();
  const buttonLabel = String(node.buttonLabel || "").trim();
  return {
    title: title.slice(0, 100),
    text: (!text || isGenericCopy(text) ? defaults.text : text).slice(0, 1000),
    buttonLabel: (!buttonLabel || isGenericCopy(buttonLabel) ? (title === nodeKinds[kind]?.title ? defaults.buttonLabel : title) : buttonLabel).slice(0, 60),
    keywords: String(node.keywords || "").slice(0, 250),
  };
}

export function createBuilderBaseline(greeting = "Здравствуйте! Расскажите, чем мы можем помочь — подскажем следующий шаг.") {
  const nodes = [
    { id: "start", type: "workflow", position: { x: 40, y: 220 }, data: { kind: "start", title: "Новый пользователь" } },
    { id: "welcome", type: "workflow", position: { x: 300, y: 220 }, data: { kind: "message", title: "Приветствие", text: String(greeting).slice(0, 1000), buttonLabel: "Начать", keywords: "" } },
    { id: "menu", type: "workflow", position: { x: 560, y: 220 }, data: { kind: "menu", title: "Главное меню", text: "Выберите, чем мы можем помочь — подскажем подходящий вариант.", buttonLabel: "Выбрать вариант", keywords: "" } },
    { id: "fallback", type: "workflow", position: { x: 560, y: 470 }, data: { kind: "fallback", title: "Ответ по умолчанию", text: "Пока не получилось распознать запрос. Выберите вариант ниже или напишите подробнее — постараемся помочь.", buttonLabel: "Нужна помощь", keywords: "" } },
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
  const data = completeNodeCopy(node.kind, node);
  return {
    id,
    type: "workflow",
    position: { x: 300 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 170 },
    data: { kind: node.kind, ...data },
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
        const fallbackCopy = completeNodeCopy(node.data.kind, node.data);
        let value = update[field];
        if (field === "text" && isGenericCopy(value)) value = fallbackCopy.text;
        if (field === "buttonLabel" && isGenericCopy(value)) value = node.data.title || fallbackCopy.buttonLabel;
        if (field === "text" && node.data.kind === "question") value = normalizeQuestionText(value);
        node.data[field] = value.slice(0, field === "text" ? 1000 : 250);
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
    const id = proposedId && !nodeById.has(proposedId) ? proposedId : `ai-${randomHex(5)}`;
    if (proposedId) addedIdMap.set(proposedId, id);
    const next = {
      id,
      type: "workflow",
      position: { x: 300 + ((nodes.length + index) % 4) * 240, y: 120 + Math.floor((nodes.length + index) / 4) * 170 },
      data: { kind: node.kind, ...completeNodeCopy(node.kind, node) },
    };
    if (next.data.kind === "question") next.data.text = normalizeQuestionText(next.data.text);
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
    const targetNode = nodeById.get(mappedTarget);
    const requestedLabel = String(label || "").trim();
    const edgeLabel = !requestedLabel || isGenericCopy(requestedLabel) ? targetNode.data.buttonLabel || targetNode.data.title || "Выбрать вариант" : requestedLabel;
    edges.push({ id: `edge-${randomHex(6)}`, source: mappedSource, target: mappedTarget, label: edgeLabel.slice(0, 60), type: "default" });
  };
  for (const edge of (Array.isArray(generated?.edges) ? generated.edges : []).slice(0, 40)) addEdge(edge?.source, edge?.target, edge?.label);

  // A common model mistake is to represent a single menu choice as a second
  // one-button menu (sometimes attached to an unrelated existing branch).
  // Collapse that node into a direct choice on the existing main menu.
  const primaryMenu = baseNodes.map((node) => nodeById.get(node.id)).find((node) => node?.data?.kind === "menu")
    || nodes.find((node) => node.data.kind === "menu");
  if (primaryMenu) {
    const misplacedActionMenuIds = nodes
      .filter((node) => node.id !== primaryMenu.id && node.data.kind === "menu"
        && /(?:запис|брон|заявк|заказ|оплат|купить|услуг)/iu.test(`${node.data.title} ${node.data.buttonLabel}`)
        && edges.some((edge) => edge.target === node.id && nodeById.get(edge.source)?.data?.kind === "subscribe"))
      .map((node) => node.id);
    for (const nodeId of new Set([...addedIds, ...misplacedActionMenuIds])) {
      const actionMenu = nodeById.get(nodeId);
      if (!actionMenu || actionMenu.data.kind !== "menu" || !/(?:запис|брон|заявк|заказ|оплат|купить|услуг)/iu.test(`${actionMenu.data.title} ${actionMenu.data.buttonLabel}`)) continue;
      const outgoing = edges.filter((edge) => edge.source === nodeId);
      if (outgoing.length !== 1) continue;
      const targetId = outgoing[0].target;
      if (!nodeById.has(targetId) || targetId === primaryMenu.id) continue;
      const label = actionMenu.data.buttonLabel || actionMenu.data.title;
      for (let index = edges.length - 1; index >= 0; index -= 1) {
        if (edges[index].source === nodeId || edges[index].target === nodeId) edges.splice(index, 1);
      }
      const nodeIndex = nodes.findIndex((item) => item.id === nodeId);
      if (nodeIndex >= 0) nodes.splice(nodeIndex, 1);
      nodeById.delete(nodeId);
      addedIds.delete(nodeId);
      addEdge(primaryMenu.id, targetId, label);
    }
  }

  if (wantsDocuments) {
    let documentNode = nodes.find((node) => node.data.kind === "document");
    const menuNode = nodes.find((node) => node.data.kind === "menu");
    if (!documentNode) {
      const id = `document-${randomHex(4)}`;
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
  for (const node of nodes) if (node.data.kind === "question") node.data.text = normalizeQuestionText(node.data.text);
  return {
    workflow: { nodes, edges },
    addedCount: Math.max(0, nodes.length - baseNodes.length),
    updatedCount,
    removedCount: removedNodeIds.size,
    changed: JSON.stringify({ nodes, edges }) !== JSON.stringify({ nodes: baseNodes, edges: baseEdges }),
  };
}

