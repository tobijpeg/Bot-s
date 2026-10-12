import test from "node:test";
import assert from "node:assert/strict";
import { createWorkflowRuntime, isValidTelegramChatId } from "./workflow-runtime.js";
import { nodeKinds } from "./workflow.js";

class TestInlineKeyboard {
  constructor() { this.buttons = []; }
  text(text, callbackData) { this.buttons.push({ text, callbackData }); return this; }
  url(text, url) { this.buttons.push({ text, url }); return this; }
  row() { return this; }
}
class TestKeyboard {
  requestLocation(text) { this.locationLabel = text; return this; }
  resized() { return this; }
  oneTime() { return this; }
}

function harness() {
  const states = new Map();
  const runtime = createWorkflowRuntime({ InlineKeyboard: TestInlineKeyboard, Keyboard: TestKeyboard, setConversationState: (key, value) => states.set(key, value) });
  const sent = [];
  const ctx = {
    chat: { id: 123456789 },
    from: { id: 123456789, first_name: "Алия", username: "aliya" },
    api: {
      sentToOwner: [],
      async sendMessage(chatId, text) { this.sentToOwner.push({ chatId, text }); },
    },
    async reply(text, extra) { sent.push({ text, extra }); },
  };
  const record = { id: "bot-1", telegramId: "987654321", username: "shop_bot", config: { ownerTelegramId: "123456789", workflow: { nodes: [], edges: [] } } };
  return { runtime, states, sent, ctx, record };
}
function node(id, kind, data = {}) { return { id, type: "workflow", data: { kind, title: id, ...data } }; }
function edge(source, target, label = "") { return { source, target, label }; }

test("start and welcome messages traverse a single path into an actionable menu", async () => {
  const { runtime, sent, ctx, record } = harness();
  record.config.greeting = "Добро пожаловать в мастерскую";
  record.config.workflow.nodes = [node("start", "start"), node("welcome", "message", { text: "старый текст" }), node("menu", "menu"), node("catalog", "catalog", { buttonLabel: "Каталог" })];
  record.config.workflow.edges = [edge("start", "welcome"), edge("welcome", "menu"), edge("menu", "catalog", "Каталог")];
  await runtime.executeFlow(ctx, record, "start");
  assert.deepEqual(sent.map((item) => item.text), ["Добро пожаловать в мастерскую", "Выберите действие:"]);
  assert.deepEqual(sent[1].extra.reply_markup.buttons, [{ text: "Каталог", callbackData: "flow:catalog" }]);
});

test("menu and condition branches skip missing targets and cap Telegram callback buttons", async () => {
  const { runtime, sent, ctx, record } = harness();
  record.config.workflow.nodes = [node("menu", "menu"), ...Array.from({ length: 10 }, (_, index) => node(`n${index}`, "message", { title: `Действие ${index}` }))];
  record.config.workflow.edges = [edge("menu", "missing", "broken"), ...Array.from({ length: 10 }, (_, index) => edge("menu", `n${index}`, `Вариант ${index}`))];
  await runtime.executeFlow(ctx, record, "menu");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].extra.reply_markup.buttons.length, 8);
  assert.equal(sent[0].extra.reply_markup.buttons[0].callbackData, "flow:n0");

  sent.length = 0;
  record.config.workflow.nodes[0] = node("branch", "condition", { text: "Какой формат вам удобен?" });
  record.config.workflow.edges = [edge("branch", "n0", "В офисе")];
  await runtime.executeFlow(ctx, record, "branch");
  assert.equal(sent[0].text, "Какой формат вам удобен?");
  assert.equal(sent[0].extra.reply_markup.buttons[0].callbackData, "flow:n0");
});

test("catalog content is formatted, split safely, and falls back to configured text when empty", async () => {
  const { runtime, sent, ctx, record } = harness();
  record.config.items = [{ name: "Ремонт", price: 12500 }, { name: "Диагностика", price: 0 }];
  record.config.workflow.nodes = [node("catalog", "catalog")];
  await runtime.executeFlow(ctx, record, "catalog");
  assert.match(sent[0].text.replace(/[\u00a0\u202f]/g, " "), /Ремонт — 12 500 ₸/);
  assert.match(sent[0].text, /Диагностика — 0 ₸/);

  sent.length = 0;
  record.config.items = [];
  record.config.workflow.nodes = [node("catalog", "catalog", { text: "Наш каталог временно обновляется." })];
  await runtime.executeFlow(ctx, record, "catalog");
  assert.equal(sent[0].text, "Наш каталог временно обновляется.");

  sent.length = 0;
  record.config.items = [{ name: "Товар", price: 1 }, { name: "x".repeat(4001), price: 1 }];
  record.config.workflow.nodes = [node("catalog", "catalog")];
  await runtime.executeFlow(ctx, record, "catalog");
  assert.ok(sent.every((item) => item.text.length <= 4000));
});

test("contacts, fallback and long messages always produce a Telegram-safe response", async () => {
  const { runtime, sent, ctx, record } = harness();
  record.config.workflow.nodes = [node("contacts", "contacts")];
  record.config.contacts = { address: "Алматы", hours: "09:00–18:00", phone: "+7 700 000 00 00" };
  await runtime.executeFlow(ctx, record, "contacts");
  assert.equal(sent[0].text, "Алматы\n09:00–18:00\n+7 700 000 00 00");

  sent.length = 0;
  record.config.workflow.nodes = [node("fallback", "fallback", { text: "z".repeat(8100) })];
  await runtime.executeFlow(ctx, record, "fallback");
  assert.deepEqual(sent.map((item) => item.text.length), [4000, 4000, 100]);
});

test("all customer-input blocks persist state and can continue into multi-way choices", async () => {
  for (const kind of ["booking", "question", "feedback", "subscribe", "document", "location"]) {
    const { runtime, states, sent, ctx, record } = harness();
    record.config.workflow.nodes = [node(kind, kind)];
    await runtime.executeFlow(ctx, record, kind);
    assert.equal(states.get(`987654321:${ctx.chat.id}`).kind, kind, `${kind} should await a response`);
    assert.equal(sent.length, 1, `${kind} should explain the next action`);
  }

  const { runtime, sent, ctx, record } = harness();
  record.config.workflow.nodes = [node("question", "question"), node("yes", "message"), node("no", "message")];
  record.config.workflow.edges = [edge("question", "yes", "Да"), edge("question", "no", "Нет")];
  await runtime.continueFromNode(ctx, record, "question");
  assert.equal(sent[0].text, "Выберите, что сделать дальше:");
  assert.deepEqual(sent[0].extra.reply_markup.buttons.map((button) => button.callbackData), ["flow:yes", "flow:no"]);
});

test("handoff collects a message while notification delivers immediately to a group chat ID", async () => {
  const { runtime, states, sent, ctx, record } = harness();
  record.config.ownerTelegramId = "-1001234567890";
  record.config.workflow.nodes = [node("handoff", "handoff", { text: "Напишите администратору" })];
  await runtime.executeFlow(ctx, record, "handoff");
  assert.equal(ctx.api.sentToOwner.length, 0, "operator handoff should wait for the customer's message");
  assert.equal(states.get(`987654321:${ctx.chat.id}`).kind, "handoff");
  assert.equal(sent[0].text, "Напишите администратору");

  record.config.workflow.nodes = [node("notification", "notification", { text: "Новая заявка" })];
  await runtime.executeFlow(ctx, record, "notification");
  assert.equal(ctx.api.sentToOwner[0].chatId, "-1001234567890");
  assert.match(ctx.api.sentToOwner[0].text, /Новая заявка/);
  assert.equal(sent.at(-1).text, "Передал сообщение владельцу.");
});

test("payment and link only create HTTPS buttons; invalid links receive clear copy", async () => {
  const { runtime, sent, ctx, record } = harness();
  for (const kind of ["payment", "link"]) {
    record.config.workflow.nodes = [node(kind, kind, { url: "https://example.kz/pay", buttonLabel: "Перейти" })];
    await runtime.executeFlow(ctx, record, kind);
    assert.equal(sent.at(-1).extra.reply_markup.buttons[0].url, "https://example.kz/pay");
    record.config.workflow.nodes = [node(kind, kind, { url: "javascript:alert(1)" })];
    await runtime.executeFlow(ctx, record, kind);
    assert.equal(sent.at(-1).extra, undefined);
    assert.match(sent.at(-1).text, /ссылка/i);
  }
});

test("location asks for a Telegram location and cycles are cut off", async () => {
  const { runtime, states, sent, ctx, record } = harness();
  record.config.workflow.nodes = [node("location", "location"), node("again", "message", { text: "Повтор" }), node("loopA", "message", { text: "A" }), node("loopB", "message", { text: "B" })];
  record.config.workflow.edges = [edge("location", "again"), edge("again", "location"), edge("loopA", "loopB"), edge("loopB", "loopA")];
  await runtime.executeFlow(ctx, record, "location");
  assert.equal(sent[0].extra.reply_markup.locationLabel, "📍 Отправить геолокацию");
  assert.equal(states.get(`987654321:${ctx.chat.id}`).nodeId, "location");
  await runtime.executeFlow(ctx, record, "loopA");
  assert.equal(sent.length, 3, "loop re-entry should be stopped without flooding Telegram");
});

test("keyword and delay nodes continue through their next step without losing the configured delay copy", async () => {
  const { runtime, sent, ctx, record } = harness();
  record.config.workflow.nodes = [node("keyword", "keyword"), node("delay", "delay", { text: "Продолжаем", delaySeconds: 0 }), node("end", "message", { text: "Готово" })];
  record.config.workflow.edges = [edge("keyword", "delay"), edge("delay", "end")];
  await runtime.executeFlow(ctx, record, "keyword");
  assert.deepEqual(sent.map((item) => item.text), ["Продолжаем", "Готово"]);
});

test("every block type offered by the editor has a runtime handler", async () => {
  const awaitingReply = new Set(["booking", "question", "feedback", "subscribe", "document", "location", "handoff"]);
  for (const kind of Object.keys(nodeKinds)) {
    const { runtime, states, sent, ctx, record } = harness();
    record.config.workflow.nodes = [node(kind, kind, { text: "Настроенный текст", keywords: "помощь", url: "https://example.kz", delaySeconds: 0 })];
    await runtime.executeFlow(ctx, record, kind);
    if (awaitingReply.has(kind)) assert.equal(states.get(`987654321:${ctx.chat.id}`)?.kind, kind, `${kind} must retain a pending client response`);
    else if (["start", "keyword"].includes(kind)) assert.equal(sent.length, 0, `${kind} should act as a trigger`);
    else assert.ok(sent.length > 0, `${kind} should produce a visible result`);
    assert.ok(!sent.some((item) => /больше не поддерживается/.test(item.text)), `${kind} must have a concrete runtime handler`);
  }
});

test("owner chat IDs accept private and group IDs but reject malformed input", () => {
  assert.equal(isValidTelegramChatId("123456789"), true);
  assert.equal(isValidTelegramChatId("-1001234567890"), true);
  assert.equal(isValidTelegramChatId("123"), false);
  assert.equal(isValidTelegramChatId("12x456789"), false);
});
