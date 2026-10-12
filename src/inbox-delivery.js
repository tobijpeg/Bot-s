const INBOX_MIGRATION_ERROR = "Не удалось подготовить ответ в базе данных. Примените миграции раздела «Входящие», включая supabase/migrations/202610120006_fix_send_inbox_reply_ambiguity.sql, и попробуйте снова.";

export class InboxReplyError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "InboxReplyError";
    this.status = status;
  }
}

function normalizeRpcRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function telegramDescription(error) {
  const description = error?.description || error?.error?.description;
  return description ? String(description).slice(0, 300) : "временная ошибка соединения с Telegram";
}

/** Stores a pending outbound message, delivers it through the customer's bot,
 * and compensates the inbox row if delivery or bot lookup fails. */
export async function deliverInboxReply({
  ownerId,
  conversationId,
  text,
  serviceRpc,
  getOwnedBot,
  runningBots,
  createBot,
  decrypt,
  onCleanupError = () => {},
}) {
  let reply;
  try {
    reply = normalizeRpcRow(await serviceRpc("send_inbox_reply", {
      p_owner_id: ownerId,
      p_conversation_id: conversationId,
      p_text: text,
    }));
  } catch (error) {
    if (/send_inbox_reply|schema cache|does not exist|could not find the function|ambiguous|42702|PGRST202/i.test(error.message || "")) {
      throw new InboxReplyError(503, INBOX_MIGRATION_ERROR);
    }
    throw new InboxReplyError(503, "Не удалось сохранить ответ. Проверьте соединение с Supabase и попробуйте ещё раз.");
  }
  if (!reply?.id || !reply.bot_id || !reply.telegram_chat_id) {
    throw new InboxReplyError(404, "Диалог не найден или уже закрыт.");
  }

  try {
    const record = await getOwnedBot({ id: ownerId }, reply.bot_id);
    if (!record) throw new InboxReplyError(404, "Бот этого диалога не найден или недоступен вашему аккаунту.");
    const instance = runningBots.get(record.id);
    const bot = instance?.bot || createBot(decrypt(record.encryptedToken));
    await bot.api.sendMessage(String(reply.telegram_chat_id), text);
    return { id: reply.id, direction: "outbound", kind: "text", text, created_at: reply.created_at };
  } catch (error) {
    try {
      await serviceRpc("delete_inbox_message", { p_message_id: reply.id, p_owner_id: ownerId });
    } catch (cleanupError) {
      onCleanupError(cleanupError, reply.id);
    }
    if (error instanceof InboxReplyError) throw error;
    throw new InboxReplyError(502, `Telegram не доставил ответ: ${telegramDescription(error)}`);
  }
}
