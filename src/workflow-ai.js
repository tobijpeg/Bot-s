import { nodeKinds } from "./workflow.js";

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const NEW_WORKFLOW_REQUEST = /(?:с\s+нуля|нов(?:ый|ую|ое|ого)\s+(?:сценар|структур|бот)|(?:созда|сдела|собер|постро).{0,80}(?:бот|сценар|структур)|(?:нужен|нужна|нужно|хочу).{0,50}(?:бот|сценар|структур)|(?:бот|сценар|структур).{0,50}(?:создать|сделать|построить|собрать)|(?:create|build|make|design).{0,80}(?:bot|workflow|flow|scenario)|(?:need|want).{0,50}(?:bot|workflow|flow|scenario))/iu;
const EDIT_REQUEST = /(?:добав|измени|помен|удал|убер|соедини|свяж|переимен|обнов|допол|перенес|отредактир|исправ|передвин)/iu;
const BUSINESS_TYPE_HINTS = [
  { kind: "cafe", match: /(?:кафе|кофейн|кофех|ресторан|бистро|пицц|пекарн|кондитер|coffee|cafe|restaurant|bistro)/iu },
  { kind: "repair", match: /(?:сервисн.{0,12}центр|ремонт|автосервис|мастерск|оборудован|сантехник|электрик)/iu },
  { kind: "shop", match: /(?:магазин|интернет-магаз|одежд|обув|маркетплейс|розничн.{0,12}торгов)/iu },
  { kind: "beauty", match: /(?:салон красоты|маникюр|педикюр|парикмах|барбер|косметолог)/iu },
  { kind: "education", match: /(?:обучен|курс|школ|репетитор|урок|вебинар|образован)/iu },
  { kind: "medical", match: /(?:клиник|стоматолог|врач|медицин|аптек)/iu },
];

const GREETING_ONLY = /^(?:(?:привет(?:ствую)?|здравствуй(?:те)?|доброе утро|добрый день|добрый вечер|сәлем(?:етсіз бе)?|қайырлы таң|қайырлы күн|қайырлы кеш|hello|hi|hey|good morning|good afternoon|good evening)[!,.?\s]*(?:(?:как дела(?: у вас)?|как вы|что нового|чем можете помочь|что ты умеешь|как настроение)[!,.?\s]*)?)+$/iu;
const BUILDER_SCOPE_SIGNAL = /(?:telegram|телеграм|\bтг\b|бот(?:а|у|ом|ы)?|сценар(?:ий|ия|ием|ии)|структур(?:а|у|ой|ы)|схем(?:а|у|ы|е)|блок(?:и|ов|а)?|кноп(?:ка|ки|ок)|главн\w* меню|конструктор|автоматизац|процесс|анкета|форма|workflow|\bmenu\b|\bbutton\b|\bblock\b|\bbot\b|\btelegram\b)/iu;
const BUSINESS_TASK_SIGNAL = /(?:клиент|заявк|запис|брон|заказ|достав|каталог|товар|услуг|поддержк|оплат|документ|файл|подписк|курс|ученик|школ|салон|барбер|магазин|кафе|кофейн|ресторан|ремонт|сервис|клиник|студия|ателье|фотограф|мастер|бизнес|business|customer|booking|order|delivery|catalog|support|appointment|shop|store|salon|course|repair|clinic|studio|submit|coffee|cafe|restaurant|заяв|тапсырыс|жеткіз|жазыл|клиент|дүкен|сұлулық|қызмет)/iu;
const CLARIFICATION_ANSWER_SIGNAL = /(?:имя|аты|телефон|номер|байланыс|адрес|мекенжай|город|қала|дата|күн|время|уақыт|услуг|қызмет|заказ|тапсырыс|товар|тауар|количеств|гост|адам|клиент|мастер|врач|ученик|курс|достав|жеткіз|самовывоз|навынос|подтверж|раста|уведом|входящ|заявк|оплат|kaspi|касса|налич|завтра|сегодня|утром|вечером|позже|кажд|ежеднев|перв|втор|трет|понедельник|вторник|сред|четверг|пятниц|суббот|воскресен|выходн|будн|онлайн|офлайн|лично|очно|дистанц|zoom|whatsapp|казах|русск|англ|\bда\b|\bнет\b|\b\d+\b|email|e-mail|telegram|\bв\b.{0,20}\d{1,2}:\d{2})/iu;
const UNRELATED_CHAT_SIGNAL = /(?:погод|анекдот|домашк|фильм|сериал|игр(?:а|у|ы)?|математик|физик|хими|политик|рецепт|гороскоп|мем)/iu;

export function sanitizeBuilderText(value, maxLength = 1200) {
  return String(value || "").replace(/\b\d{6,12}:[A-Za-z0-9_-]{25,}\b/g, "[токен Telegram скрыт]").trim().slice(0, maxLength);
}

export function classifyBuilderMessage(value, { hasPendingClarification = false } = {}) {
  const text = String(value || "").trim();
  if (GREETING_ONLY.test(text)) return "greeting";
  if (hasPendingClarification && UNRELATED_CHAT_SIGNAL.test(text)) return "off_topic";
  if (BUILDER_SCOPE_SIGNAL.test(text) || BUSINESS_TASK_SIGNAL.test(text)) return "builder";
  if (hasPendingClarification && CLARIFICATION_ANSWER_SIGNAL.test(text)) return "builder";
  if (hasPendingClarification && /^(?:да|нет|хорошо|подходит|не знаю|иә|жоқ|болады|yes|no|okay|ok)[!,.?\s]*$/iu.test(text)) return "builder";
  if (hasPendingClarification && (text.match(/\p{L}{3,}/gu) || []).length >= 2) return "builder";
  return "off_topic";
}

export function getBuilderGateReply(intent, locale = "ru") {
  const messages = {
    greeting: {
      ru: "Здравствуйте! Я помогу создать или изменить сценарий Telegram-бота для вашего бизнеса: настроить меню, заявки, запись, заказы и другие шаги.",
      kk: "Сәлеметсіз бе! Бизнесіңізге арналған Telegram-бот сценарийін құруға не өзгертуге көмектесемін: мәзір, өтінім, жазылу, тапсырыс және басқа қадамдар.",
      en: "Hello! I can help you create or edit a Telegram bot workflow for your business, including menus, enquiries, bookings, orders and other steps.",
    },
    off_topic: {
      ru: "Я помогаю только с созданием и настройкой Telegram-ботов. Опишите бизнес-задачу или изменение сценария — например, какие действия клиент должен выполнить и что нужно получить от него.",
      kk: "Мен тек Telegram-боттарды құруға және баптауға көмектесемін. Бизнес міндетін немесе сценарийдегі өзгерісті жазыңыз: клиент не істеуі керек және қандай дерек қалдыруы қажет.",
      en: "I only help create and configure Telegram bots. Describe the business task or workflow change, such as what customers should do and what information you need from them.",
    },
    need_task: {
      ru: "Расскажите, что именно должен делать бот или что нужно изменить: какое действие выполняет клиент, какие данные оставить и что происходит после этого.",
      kk: "Бот нақты не істеуі керек немесе нені өзгерту қажет екенін жазыңыз: клиенттің әрекеті, қажет деректер және одан кейінгі қадам.",
      en: "Tell me what the bot should do or what to change: the customer's action, the information to collect, and what should happen next.",
    },
  };
  return messages[intent]?.[locale] || messages[intent]?.ru || "Опишите задачу для Telegram-бота.";
}

function parseClarificationContext(question) {
  const value = String(question || "");
  const marker = "Ответы владельца на уточняющие вопросы:";
  const firstMarker = value.indexOf(marker);
  const sections = [...value.matchAll(/Ответы владельца на уточняющие вопросы:([\s\S]*?)(?=\n\s*(?:Раунд уточнений:|Выполни исходную просьбу|Ответы владельца на уточняющие вопросы:)|$)/gu)]
    .map((match) => match[1]
      .replace(/^\s*\d+[.)]\s*Вопросы?:[^\n]*(?:\r?\n)?/gimu, " ")
      .replace(/\bВопросы?:[^\n]*/gimu, " ")
      .replace(/\bРаунд уточнений:\s*\d+/giu, " ")
      .trim())
    .filter(Boolean);
  const rounds = [...value.matchAll(/Раунд уточнений:\s*(\d+)/giu)].map((match) => Number(match[1]));
  return {
    request: firstMarker >= 0 ? value.slice(0, firstMarker).trim() : value.trim(),
    answers: sections.join(" ").trim(),
    round: rounds.length ? Math.max(...rounds) : 0,
  };
}

export function shouldAskBuilderClarification(question, context = {}) {
  // Base the decision on the current brief and its actual answers, not on
  // unrelated older chat turns or the helper instructions appended by the UI.
  const clarification = parseClarificationContext(question);
  if (clarification.round >= 2) return false;
  const text = [clarification.request, clarification.answers, context.description, context.businessName]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text || isAllFeatureRequest(text)) return false;
  const detailGroups = [
    /(?:заказ|брон|запис|достав|каталог|поддержк|заявк|оплат|курс|услуг|выбрать|получить|показать|booking|order|delivery|appointment|choose|show|submit)/iu,
    /(?:имя|аты|телефон|номер|адрес|мекенжай|дата|время|уақыт|количеств|гост|контакт|email)/iu,
    /(?:затем|потом|после|подтверд|уведом|передать|входящ|связаться|раста|хабарла|содан кейін|then|after that|confirm|notify|inbox)/iu,
  ];
  return detailGroups.filter((pattern) => pattern.test(text)).length < 2;
}

function normalizeQuestionText(text) {
  const value = String(text || "").slice(0, 1000);
  const hasChoices = /(?:^|\n)\s*(?:[•*-]|\d+[.)])\s*\S/m.test(value);
  if (!hasChoices && /выберите.{0,60}(?:из списка|услуг(?:у|и))/iu.test(value)) return "Напишите, какая услуга вам нужна.";
  return value;
}

export function isWorkflowCreationRequest(question) {
  const text = String(question || "").trim();
  if (NEW_WORKFLOW_REQUEST.test(text)) return true;
  return false;
}

export function isBuilderCreationIntent(question) {
  const text = String(question || "").trim();
  if (isWorkflowCreationRequest(text)) return true;
  if (EDIT_REQUEST.test(text)) return false;
  return BUSINESS_TASK_SIGNAL.test(text);
}

export function isBuilderEditRequest(question) {
  return EDIT_REQUEST.test(String(question || "").trim());
}

export function isAllFeatureRequest(question) {
  return /(?:\ball\s+(?:features|functions|blocks)\b|\bevery\s+(?:feature|function|block)\b|абсолютно\s+все\s+(?:функц|блок|возможност)|все(?:ми)?\s+(?:перечислен[\p{L}]*\s+(?:ниже\s+)?)?(?:функц|тип\w*\s+блок|блоки|блоков|возможност)|всю\s+библиотек\w*|кажд\w*\s+тип\w*\s+блок)/iu.test(String(question || ""));
}

function lastMatchIndex(text, pattern) {
  const matcher = new RegExp(pattern.source, `${pattern.flags.replace(/[gy]/g, "")}g`);
  let lastIndex = -1;
  for (const match of text.matchAll(matcher)) lastIndex = match.index;
  return lastIndex;
}

export function detectWorkflowBusinessType(question, context = {}) {
  const requestedText = String(question || "");
  const requestedMatches = BUSINESS_TYPE_HINTS.map(({ kind, match }) => ({ kind, index: lastMatchIndex(requestedText, match) })).filter(({ index }) => index >= 0);
  if (requestedMatches.length) return requestedMatches.reduce((latest, entry) => entry.index > latest.index ? entry : latest).kind;
  const existingContext = [context.businessName, context.description, context.template].filter(Boolean).join(" ");
  const contextMatches = BUSINESS_TYPE_HINTS.map(({ kind, match }) => ({ kind, index: lastMatchIndex(existingContext, match) })).filter(({ index }) => index >= 0);
  return contextMatches.length ? contextMatches.reduce((latest, entry) => entry.index > latest.index ? entry : latest).kind : "general";
}

export function isGeneratedWorkflowRelevant(question, workflow, context = {}) {
  const businessType = detectWorkflowBusinessType(question, context);
  const relevantText = [
    ...(workflow?.nodes || []).map((node) => `${node.data?.title || ""} ${node.data?.text || ""} ${node.data?.buttonLabel || ""}`),
    ...(workflow?.edges || []).map((edge) => edge.label || ""),
  ].join(" ");
  const topicPatterns = {
    cafe: /(?:кафе|кофейн|кофе|ресторан|меню|блюд|напит|заказ|столик|брон|coffee|cafe|restaurant|menu|dish|order|table)/iu,
    repair: /(?:ремонт|сервис|неисправ|оборудован|техник|мастер|заявк|repair|service|issue|equipment|technician)/iu,
    shop: /(?:магазин|каталог|товар|покуп|заказ|достав|shop|catalog|product|purchase|order|delivery)/iu,
    beauty: /(?:салон|красот|маникюр|педикюр|стриж|мастер|запис|beauty|salon|hair|nail|appointment)/iu,
    education: /(?:курс|обуч|заняти|ученик|студент|урок|школ|education|course|lesson|student|class)/iu,
    medical: /(?:клиник|пациент|приём|врач|запис|медицин|clinic|patient|doctor|appointment)/iu,
  };
  return !topicPatterns[businessType] || topicPatterns[businessType].test(relevantText);
}

export function cleanTemplateDataForGeneratedWorkflow({ description = "", features = [], items = [], contacts = {}, template = null } = {}) {
  const sameValue = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  const cleanedContacts = { ...contacts };
  if (cleanedContacts.hours === "Ежедневно, 10:00–20:00") cleanedContacts.hours = "";
  return {
    category: "custom",
    description: sameValue(description, template?.description) ? "" : description,
    features: sameValue(features, template?.features) ? [] : features,
    items: sameValue(items, template?.items) ? [] : items,
    contacts: cleanedContacts,
  };
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
    match: /(?:кафе|кофейн|кофехана|ресторан|мейрамхана|пекарн|наубайхана|кондитер|пицц|доставк|жеткізу|еда|тағам|столов|асхана|coffee|cafe|restaurant)/iu,
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
  const clarification = parseClarificationContext(question);
  const request = clarification.request || String(question || "").trim();
  const requestType = BUSINESS_TYPES.find(({ match }) => match.test(request));
  const profileContext = [context.description, context.businessName].filter(Boolean).join(" ");
  const businessType = requestType
    || BUSINESS_TYPES.find(({ match }) => match.test(profileContext))
    || BUSINESS_TYPES.find(({ match }) => match.test(String(context.template || "")));
  const locale = ["kk", "en"].includes(context.locale) ? context.locale : "ru";
  if (clarification.answers) {
    const answers = clarification.answers;
    const goalKnown = /(?:заказ|заказать|покуп|брон|столик|запис|достав|каталог|меню|консультац|заявк|обратн\w*\s+связ|поддержк|вопрос|оплат|курс|выбрать|booking|order|appointment|delivery|catalog|menu|support|enquiry|question)/iu.test(answers);
    const dataKnown = /(?:имя|аты|телефон|номер|адрес|мекенжай|дата|время|уақыт|количеств|гост|состав|позици|товар|модель|проблем|уровень|контакт|email|e-mail|phone|address|date|time|party|items|name|contact)/iu.test(answers)
      || /(?:телефон|номер|адрес|дата|время|имя|контакт|phone|address|date|time|name|contact)/iu.test(context.description || "");
    const nextStepKnown = /(?:подтверд|владельц|администратор|менеджер|входящ|уведом|связаться|перезвон|оператор|после этого|потом|затем|confirm|notify|owner|inbox|after that|operator)/iu.test(answers);
    const followups = [];
    const business = String(context.businessName || "ваш бизнес").trim();
    if (!goalKnown) {
      followups.push({
        ru: `Чтобы меню для «${business}» получилось полезным, выберите главную задачу бота: заказ, запись/бронь, консультация или информация о компании?`,
        kk: `«${business}» бизнесіне арналған мәзір пайдалы болуы үшін боттың негізгі міндетін таңдаңыз: тапсырыс, жазылу/брондау, кеңес немесе компания туралы ақпарат па?`,
        en: `To make the menu useful for ${business}, what should be the bot’s main job: orders, bookings, advice, or company information?`,
      }[locale]);
    }
    if (!dataKnown) {
      followups.push(businessType?.questions[locale]?.[1] || {
        ru: "Что именно нужно спросить у клиента, чтобы обработать его обращение: имя, телефон, желаемое время, адрес или описание запроса?",
        kk: "Өтінімді өңдеу үшін клиенттен нақты нені сұрау керек: аты-жөні, телефон, қалаған уақыт, мекенжай немесе өтініш сипаттамасы ма?",
        en: "What should the bot collect to handle a request: name, phone, preferred time, address, or a description?",
      }[locale]);
    }
    if (!nextStepKnown) {
      followups.push({
        ru: "Что должно произойти после ответа клиента: бот сразу покажет подтверждение или передаст обращение вам во «Входящие», чтобы вы ответили сами?",
        kk: "Клиент жауап бергеннен кейін не болуы керек: бот растауды бірден көрсете ме, әлде өтінішті өзіңіз жауап беру үшін «Кіріс» бөліміне жібере ме?",
        en: "After the customer responds, should the bot confirm immediately or send the request to your Inbox for you to reply?",
      }[locale]);
    }
    if (followups.length) return followups.slice(0, 2);
  }
  if (businessType) return businessType.questions[locale];
  return {
    ru: ["Какую главную задачу клиент должен решить через бота — получить консультацию, оставить заявку, записаться, оформить заказ или что-то другое?", "Какие 2–3 сведения нужно собрать, и что должно произойти после отправки: показать подтверждение, передать обращение вам во «Входящие» или предложить следующий шаг?"],
    kk: ["Клиент бот арқылы қандай негізгі міндетті орындауы керек: кеңес алу, өтінім қалдыру, жазылу, тапсырыс беру немесе басқа әрекет пе?", "Қандай 2–3 мәліметті жинау керек және жауаптан кейін не болсын: растау көрсету, өтінімді сіздің «Кіріс» бөліміне жіберу немесе келесі қадамды ұсыну ма?"],
    en: ["What main task should customers complete with the bot: get advice, submit a request, book, place an order, or something else?", "Which 2–3 details should it collect, and what should happen next: show confirmation, send the request to your Inbox, or offer another step?"],
  }[locale];
}

export function normalizeBuilderClarificationQuestions(value, question, context = {}) {
  const fallback = getWorkflowClarificationQuestions(question, context);
  const generated = Array.isArray(value) ? value : [];
  const usable = generated
    .map((item) => sanitizeBuilderText(item, 320).replace(/\s+/gu, " "))
    .filter((item) => item.length >= 18 && !/(?:json|api|backend|разработчик|тестировщик|внутренн(?:ий|яя)|id узла|модель данных)/iu.test(item));
  return [usable[0] || fallback[0], usable[1] || fallback[1]];
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

export function createAllFeatureWorkflow(question, context = {}) {
  const businessType = detectWorkflowBusinessType(question, context);
  const isCafe = businessType === "cafe";
  const workflow = createBuilderBaseline(isCafe
    ? "Добро пожаловать! Здесь можно посмотреть меню, оформить заказ, забронировать столик или связаться с нами."
    : "Добро пожаловать! Выберите раздел, чтобы посмотреть доступные функции и связаться с компанией.");
  const mainMenu = workflow.nodes.find((node) => node.id === "menu");
  mainMenu.data.text = "Выберите раздел — внутри собраны функции бота.";

  const groups = [
    { id: "menu-catalog", title: isCafe ? "Меню и ссылки" : "Каталог и ссылки", label: isCafe ? "🍽️ Меню и ссылки" : "🛍️ Каталог и ссылки", kinds: ["message", "catalog", "payment", "link"] },
    { id: "menu-requests", title: isCafe ? "Заказ и бронь" : "Заявки и документы", label: isCafe ? "📝 Заказ и бронь" : "📨 Заявки и документы", kinds: ["booking", "question", "document"] },
    { id: "menu-support", title: "Контакты и помощь", label: "📍 Контакты и помощь", kinds: ["contacts", "location", "handoff"] },
    { id: "menu-updates", title: "Отзывы и новости", label: "⭐ Отзывы и новости", kinds: ["feedback", "subscribe"] },
    { id: "menu-tools", title: "Дополнительные функции", label: "⚙️ Дополнительные функции", kinds: ["keyword", "condition", "delay", "notification"] },
  ];
  const copy = {
    message: { title: "Информация о компании", text: "Здесь появится информация о компании. Если хотите что-то уточнить, напишите нам в чат.", buttonLabel: "ℹ️ О компании" },
    catalog: { title: isCafe ? "Меню кафе" : "Каталог товаров и услуг", text: isCafe ? "Меню пока не заполнено. Напишите нам, чтобы уточнить ассортимент." : "Каталог пока пуст. Напишите нам, чтобы уточнить ассортимент.", buttonLabel: isCafe ? "Открыть меню" : "Открыть каталог" },
    payment: { title: "Ссылка на оплату", text: "Онлайн-оплата пока недоступна. Напишите нам, чтобы уточнить способ оплаты.", buttonLabel: "Перейти к оплате" },
    link: { title: "Полезная ссылка", text: "Ссылка пока недоступна. Выберите другой раздел или напишите нам в чат.", buttonLabel: "Открыть ссылку" },
    booking: { title: isCafe ? "Бронирование столика" : "Запись или заявка", text: isCafe ? "Укажите дату и время, число гостей, имя и телефон. Мы свяжемся с вами для подтверждения брони." : "Опишите нужную услугу и удобное время, оставьте имя и телефон для связи.", buttonLabel: isCafe ? "Забронировать столик" : "Оставить заявку" },
    question: { title: isCafe ? "Вопрос заведению" : "Задать вопрос", text: isCafe ? "Напишите ваш вопрос заведению одним сообщением." : "Опишите вопрос одним сообщением — владелец сможет ответить вам в чате.", buttonLabel: "Задать вопрос" },
    document: { title: "Приём документов", text: "Пришлите документ или фото, которое хотите передать компании.", buttonLabel: "📎 Отправить документ" },
    contacts: { title: "Контакты компании", text: "Контактная информация пока не указана. Напишите нам сообщение в этом чате.", buttonLabel: "Показать контакты" },
    location: { title: "Отправить геолокацию", text: "Поделитесь геолокацией, если хотите указать место встречи или доставки.", buttonLabel: "📍 Отправить геолокацию" },
    handoff: { title: "Связь с оператором", text: "Напишите сообщение — сотрудник ответит вам в этом чате.", buttonLabel: "Написать оператору" },
    feedback: { title: "Оставить отзыв", text: "Оцените ваш опыт и напишите, что можно улучшить.", buttonLabel: "⭐ Оставить отзыв" },
    subscribe: { title: "Подписка на новости", text: "Если хотите получать новости, напишите «Подписаться». Рассылку владелец сможет организовать отдельно.", buttonLabel: "📣 Подписаться на новости" },
    keyword: { title: "Поиск по ключевым словам", text: "Напишите «контакты», «адрес» или «график», чтобы открыть контактную информацию.", buttonLabel: "Проверить ключевые слова", keywords: "контакты,адрес,график" },
    condition: { title: "Выбор варианта", text: isCafe ? "Выберите, что вам нужно." : "Выберите подходящий следующий шаг.", buttonLabel: "Выбрать вариант" },
    delay: { title: "Пауза и ожидание", text: "Пауза завершена. Можно выбрать другую функцию.", buttonLabel: "Проверить паузу", delaySeconds: 1 },
    notification: { title: "Уведомить владельца", text: "Связь с сотрудником пока недоступна. Попробуйте другой раздел меню.", buttonLabel: "Связаться с сотрудником" },
  };
  const groupMenus = new Map();
  for (const [index, group] of groups.entries()) {
    const node = { id: group.id, type: "workflow", position: { x: 850, y: 40 + index * 145 }, data: { kind: "menu", title: group.title, text: `Выберите действие в разделе «${group.title}».`, buttonLabel: group.label, keywords: "" } };
    workflow.nodes.push(node);
    groupMenus.set(group.id, node);
    workflow.edges.push({ id: `all-features-main-${group.id}`, source: mainMenu.id, target: node.id, label: group.label });
  }

  let nextY = 40;
  const nodeByKind = new Map();
  for (const group of groups) {
    const groupMenu = groupMenus.get(group.id);
    for (const kind of group.kinds) {
      const details = copy[kind];
      const node = { id: `all-${kind}`, type: "workflow", position: { x: 1190, y: nextY }, data: { kind, title: details.title, text: details.text, buttonLabel: details.buttonLabel, keywords: details.keywords || "", ...(details.delaySeconds ? { delaySeconds: details.delaySeconds } : {}) } };
      nextY += 135;
      workflow.nodes.push(node);
      nodeByKind.set(kind, node);
      workflow.edges.push({ id: `all-features-${group.id}-${kind}`, source: groupMenu.id, target: node.id, label: details.buttonLabel });
      if (["message", "catalog", "payment", "link", "booking", "question", "document", "contacts", "location", "handoff", "feedback", "subscribe", "notification"].includes(kind)) {
        workflow.edges.push({ id: `all-features-return-${kind}`, source: node.id, target: groupMenu.id, label: "Вернуться в раздел" });
      }
    }
  }

  if (isCafe) {
    const requestMenu = groupMenus.get("menu-requests");
    const cafeActions = [
      { id: "all-takeaway-order", kind: "booking", title: "Заказ навынос", text: "Напишите, какие блюда и в каком количестве подготовить, укажите желаемое время самовывоза, имя и телефон. Мы свяжемся с вами для подтверждения заказа.", buttonLabel: "🥡 Заказать навынос" },
      { id: "all-delivery-order", kind: "question", title: "Заказ с доставкой", text: "Напишите блюда и количество, адрес и желаемое время доставки, а также телефон для связи. Мы свяжемся с вами для подтверждения заказа.", buttonLabel: "🛵 Заказать доставку" },
    ];
    const tableBooking = nodeByKind.get("booking");
    tableBooking.data.title = "Бронирование столика";
    tableBooking.data.text = "Укажите дату и время, число гостей, имя и телефон. Мы свяжемся с вами, чтобы подтвердить бронь.";
    tableBooking.data.buttonLabel = "🍽️ Забронировать столик";
    for (const [index, action] of cafeActions.entries()) {
      workflow.nodes.push({ id: action.id, type: "workflow", position: { x: 1190, y: nextY + index * 135 }, data: { kind: action.kind, title: action.title, text: action.text, buttonLabel: action.buttonLabel, keywords: "" } });
      workflow.edges.push(
        { id: `all-features-menu-requests-${action.id}`, source: requestMenu.id, target: action.id, label: action.buttonLabel },
        { id: `all-features-return-${action.id}`, source: action.id, target: requestMenu.id, label: "Вернуться к заказам" },
      );
    }
  }

  const toolsMenu = groupMenus.get("menu-tools");
  const condition = nodeByKind.get("condition");
  const questionNode = nodeByKind.get("question");
  const bookingNode = nodeByKind.get("booking");
  workflow.edges.push(
    { id: "all-condition-question", source: condition.id, target: questionNode.id, label: "Задать вопрос" },
    { id: "all-condition-booking", source: condition.id, target: bookingNode.id, label: isCafe ? "Забронировать столик" : "Оставить заявку" },
  );
  const keyword = nodeByKind.get("keyword");
  const contacts = nodeByKind.get("contacts");
  workflow.edges.push({ id: "all-keyword-contacts", source: keyword.id, target: contacts.id, label: "Показать контакты" });
  const delay = nodeByKind.get("delay");
  const delayMessage = { id: "all-delay-message", type: "workflow", position: { x: 1530, y: nextY }, data: { kind: "message", title: "Пауза завершена", text: "Готово — выберите другую функцию в разделе.", buttonLabel: "Продолжить", keywords: "" } };
  workflow.nodes.push(delayMessage);
  workflow.edges.push(
    { id: "all-delay-next", source: delay.id, target: delayMessage.id, label: "Продолжить" },
    { id: "all-delay-return", source: delayMessage.id, target: toolsMenu.id, label: "К дополнительным функциям" },
  );

  return workflow;
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

