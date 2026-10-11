export const nodeKinds = {
  start: { title: "Старт /start", icon: "▶", color: "border-green-300" },
  message: { title: "Сообщение", icon: "💬", color: "border-blue-300" },
  menu: { title: "Меню кнопок", icon: "☷", color: "border-violet-300" },
  catalog: { title: "Каталог", icon: "🛍️", color: "border-amber-300" },
  document: { title: "Приём документов", icon: "📎", color: "border-blue-400" },
  booking: { title: "Заявка / запись", icon: "📝", color: "border-pink-300" },
  question: { title: "Спросить / собрать данные", icon: "❓", color: "border-orange-300" },
  condition: { title: "Развилка / выбор варианта", icon: "◇", color: "border-fuchsia-300" },
  delay: { title: "Пауза и ожидание", icon: "◷", color: "border-sky-300" },
  notification: { title: "Уведомить владельца", icon: "🔔", color: "border-rose-300" },
  link: { title: "Открыть ссылку", icon: "↗", color: "border-teal-300" },
  location: { title: "Запросить геолокацию", icon: "⌖", color: "border-lime-300" },
  contacts: { title: "Контакты", icon: "📍", color: "border-cyan-300" },
  keyword: { title: "Ключевые слова", icon: "⌕", color: "border-indigo-300" },
  fallback: { title: "Ответ по умолчанию", icon: "↩", color: "border-gray-300" },
  handoff: { title: "Передать оператору", icon: "👤", color: "border-rose-400" },
  payment: { title: "Ссылка на оплату", icon: "💳", color: "border-emerald-400" },
  feedback: { title: "Оценка и отзыв", icon: "⭐", color: "border-yellow-400" },
  subscribe: { title: "Запрос подписки на новости", icon: "📣", color: "border-purple-400" },
};

export const nodeCategories = {
  "Основное": ["message", "menu", "fallback", "keyword"],
  "Продажи": ["catalog", "booking", "payment", "link"],
  "Заявки и поддержка": ["question", "document", "notification", "handoff", "feedback"],
  "Автоматизация": ["condition", "delay", "subscribe", "location"],
  "Информация": ["contacts"],
};

export const workflowPresets = {
  support: { label: "Поддержка клиентов", description: "Частые вопросы, сбор обращения и связь с оператором.", build: () => createPreset([
    ["support", "menu", "Поддержка", "Выберите, чем помочь", "🆘 Поддержка"],
    ["faq", "message", "Частые вопросы", "Опишите здесь ответы на частые вопросы вашей компании.", "❓ Частые вопросы"],
    ["ticket", "question", "Новое обращение", "Опишите проблему одним сообщением — передам оператору.", "✉️ Написать оператору"],
  ], [["support", "faq", "FAQ"], ["support", "ticket", "Обращение"]]) },
  appointment: { label: "Запись на услугу", description: "Сбор контакта и пожеланий для записи.", build: () => createPreset([
    ["appointments", "menu", "Запись", "Выберите действие", "📅 Запись"],
    ["service", "message", "Услуги", "Добавьте список услуг и условия записи.", "💼 Услуги"],
    ["booking", "question", "Новая запись", "Напишите услугу, удобную дату и телефон.", "📝 Записаться"],
  ], [["appointments", "service", "Услуги"], ["appointments", "booking", "Записаться"]]) },
  documents: { label: "Документы от подрядчиков", description: "Приём PDF и фото с пересылкой владельцу.", build: () => createPreset([
    ["contractors", "menu", "Подрядчикам", "Отправьте документы компании через этот бот.", "📎 Подрядчикам"],
    ["document-intake", "document", "Отправить документы", "Пришлите PDF или фото документов. Файлы будут пересланы владельцу.", "📤 Отправить документы"],
  ], [["contractors", "document-intake", "Отправить документы"]]) },
  lead: { label: "Сбор заявок", description: "Квалификация клиента и уведомление команды.", build: () => createPreset([
    ["lead-menu", "menu", "Связаться с нами", "Оставьте заявку — мы свяжемся с вами.", "📨 Оставить заявку"],
    ["lead-name", "question", "Детали заявки", "Напишите ваше имя, телефон и что вас интересует.", "📝 Заявка"],
  ], [["lead-menu", "lead-name", "Оставить заявку"]]) },
  feedback: { label: "Отзывы и лояльность", description: "Сбор обратной связи и подписка на новости.", build: () => createPreset([
    ["loyalty", "menu", "Клиентский сервис", "Оцените сервис или подпишитесь на новости.", "💜 Клиентам"],
    ["review", "feedback", "Оставить отзыв", "Оцените нас от 1 до 5 и напишите комментарий.", "⭐ Оставить отзыв"],
    ["news", "subscribe", "Новости", "Подпишитесь на новости и акции компании.", "📣 Подписаться"],
  ], [["loyalty", "review", "Оставить отзыв"], ["loyalty", "news", "Новости"]]) },
};

function createPreset(specs, links) {
  const nodes = [
    { id: "start", type: "workflow", position: { x: 40, y: 220 }, data: { kind: "start", title: "Новый пользователь" } },
    { id: "fallback", type: "workflow", position: { x: 40, y: 500 }, data: { kind: "fallback", title: "Ответ по умолчанию", text: "Выберите пункт меню или напишите команде через раздел «Поддержка»." } },
  ];
  const edges = [];
  specs.forEach(([id, kind, title, text, buttonLabel], index) => nodes.push({ id, type: "workflow", position: { x: 310 + (index % 2) * 300, y: 100 + Math.floor(index / 2) * 190 }, data: { kind, title, text, buttonLabel, keywords: "" } }));
  edges.push({ id: "preset-start", source: "start", target: specs[0][0], animated: true });
  links.forEach(([source, target, label]) => edges.push({ id: `preset-${source}-${target}`, source, target, label }));
  return { nodes, edges };
}

export function botLaunchIdFromPath(pathname) {
  return pathname.match(/^\/api\/bots\/([0-9a-f-]{36})\/launch$/i)?.[1] || null;
}

export function createDefaultWorkflow() {
  const nodes = [
    { id: "start", type: "workflow", position: { x: 50, y: 210 }, data: { kind: "start", title: "Новый пользователь" } },
    { id: "welcome", type: "workflow", position: { x: 310, y: 210 }, data: { kind: "message", title: "Приветствие", text: "Здравствуйте! Добро пожаловать. Выберите действие в меню." } },
    { id: "menu", type: "workflow", position: { x: 575, y: 210 }, data: { kind: "menu", title: "Главное меню" } },
    { id: "catalog", type: "workflow", position: { x: 890, y: 25 }, data: { kind: "catalog", title: "Каталог и цены", buttonLabel: "🛍️ Каталог и цены" } },
    { id: "booking", type: "workflow", position: { x: 890, y: 210 }, data: { kind: "booking", title: "Оставить заявку", buttonLabel: "📝 Оставить заявку", text: "Чтобы оставить заявку, свяжитесь с нами по контактам из меню." } },
    { id: "contacts", type: "workflow", position: { x: 890, y: 395 }, data: { kind: "contacts", title: "Контакты", buttonLabel: "📍 Контакты" } },
    { id: "question", type: "workflow", position: { x: 1190, y: 210 }, data: { kind: "question", title: "Собрать заявку", text: "Что вас интересует? Напишите детали, и мы свяжемся с вами.", buttonLabel: "Оставить заявку" } },
    { id: "fallback", type: "workflow", position: { x: 575, y: 455 }, data: { kind: "fallback", title: "Не понял сообщение", text: "Выберите пункт меню или свяжитесь с нами по указанным контактам." } },
  ];
  const edges = [
    { id: "e-start-welcome", source: "start", target: "welcome", animated: true },
    { id: "e-welcome-menu", source: "welcome", target: "menu", animated: true },
    { id: "e-menu-catalog", source: "menu", target: "catalog", label: "Каталог" },
    { id: "e-menu-booking", source: "menu", target: "booking", label: "Заявка" },
    { id: "e-menu-contacts", source: "menu", target: "contacts", label: "Контакты" },
  ];
  return { nodes, edges };
}
