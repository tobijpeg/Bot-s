import test from "node:test";
import assert from "node:assert/strict";
import { deliverInboxReply, InboxReplyError } from "./inbox-delivery.js";

function setup({ sendError, record = { id: "bot-1", encryptedToken: "sealed" }, reply = { id: "msg-1", bot_id: "bot-1", telegram_chat_id: "7654321", created_at: "2026-10-12T10:00:00.000Z" } } = {}) {
  const calls = [];
  const instance = { bot: { api: { async sendMessage(chatId, text) { calls.push(["telegram", chatId, text]); if (sendError) throw sendError; } } } };
  const runningBots = new Map([["bot-1", instance]]);
  const dependencies = {
    ownerId: "owner-1", conversationId: "conversation-1", text: "Здравствуйте!",
    async serviceRpc(name, args) { calls.push(["rpc", name, args]); if (name === "send_inbox_reply") return reply ? [reply] : []; return []; },
    async getOwnedBot(user, botId) { calls.push(["owned-bot", user.id, botId]); return record; },
    runningBots,
    createBot() { throw new Error("should reuse running bot"); },
    decrypt(token) { calls.push(["decrypt", token]); return "telegram-token"; },
    onCleanupError(error, id) { calls.push(["cleanup-error", id, error.message]); },
  };
  return { dependencies, calls };
}

test("sends through the correct running bot and returns the persisted outbound message", async () => {
  const { dependencies, calls } = setup();
  const message = await deliverInboxReply(dependencies);
  assert.deepEqual(calls.map((call) => call[0]), ["rpc", "owned-bot", "telegram"]);
  assert.equal(calls[2][1], "7654321");
  assert.deepEqual(message, { id: "msg-1", direction: "outbound", kind: "text", text: "Здравствуйте!", created_at: "2026-10-12T10:00:00.000Z" });
});

test("rolls back the outbound row when Telegram rejects delivery", async () => {
  const { dependencies, calls } = setup({ sendError: { description: "bot was blocked by the user" } });
  await assert.rejects(deliverInboxReply(dependencies), (error) => error instanceof InboxReplyError && error.status === 502 && /bot was blocked/.test(error.message));
  assert.deepEqual(calls.map((call) => call[0]), ["rpc", "owned-bot", "telegram", "rpc"]);
  assert.equal(calls[3][1], "delete_inbox_message");
  assert.equal(calls[3][2].p_message_id, "msg-1");
});

test("removes a pending outbound row if its bot cannot be resolved", async () => {
  const { dependencies, calls } = setup({ record: null });
  await assert.rejects(deliverInboxReply(dependencies), (error) => error.status === 404 && /не найден/.test(error.message));
  assert.equal(calls.at(-1)[1], "delete_inbox_message");
});

test("does not attempt delivery or create a rollback for a closed/missing conversation", async () => {
  const { dependencies, calls } = setup({ reply: null });
  await assert.rejects(deliverInboxReply(dependencies), (error) => error.status === 404 && /закрыт/.test(error.message));
  assert.deepEqual(calls.map((call) => call[0]), ["rpc"]);
});

test("explains that inbox migrations need applying when the RPC is absent", async () => {
  const { dependencies } = setup();
  dependencies.serviceRpc = async () => { throw new Error("Could not find the function public.send_inbox_reply in the schema cache"); };
  await assert.rejects(deliverInboxReply(dependencies), (error) => error.status === 503 && /миграции раздела/.test(error.message));
});

test("surfaces rollback failures to server logs while preserving the Telegram error", async () => {
  const { dependencies, calls } = setup({ sendError: { message: "network failed" } });
  dependencies.serviceRpc = async (name, args) => {
    calls.push(["rpc", name, args]);
    if (name === "send_inbox_reply") return [{ id: "msg-1", bot_id: "bot-1", telegram_chat_id: "7654321", created_at: "now" }];
    throw new Error("database unavailable during rollback");
  };
  await assert.rejects(deliverInboxReply(dependencies), (error) => error.status === 502 && /соединения с Telegram/.test(error.message));
  assert.ok(calls.some((call) => call[0] === "cleanup-error" && call[1] === "msg-1"));
});
