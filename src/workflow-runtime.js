import { createDefaultWorkflow } from "./workflow.js";

const MAX_FLOW_DEPTH = 15;
const MAX_CHOICES = 8;
const MAX_TELEGRAM_TEXT = 4000;

export function isValidTelegramChatId(value) {
  return /^-?\d{5,20}$/.test(String(value || ""));
}

function firstOutgoingTarget(edges) {
  return edges.length === 1 ? edges[0].target : null;
}

function choiceKeyboard(workflow, edges, InlineKeyboard) {
  const keyboard = new InlineKeyboard();
  edges.slice(0, MAX_CHOICES).forEach((edge, index) => {
    const target = workflow.nodes.find((node) => node.id === edge.target);
    if (!target) return;
    const label = edge.label || target.data.buttonLabel || target.data.title || "Выбрать";
    // Telegram limits callback_data to 64 bytes. Node IDs are normally short,
    // but reject invalid targets here instead of exposing a dead button.
    const callbackData = `flow:${target.id}`;
    if (new TextEncoder().encode(callbackData).length > 64) return;
    keyboard.text([...String(label)].slice(0, 64).join(""), callbackData);
    if (index % 2 === 1) keyboard.row();
  });
  return keyboard;
}

function ownerIdOf(config) {
  return isValidTelegramChatId(config.ownerTelegramId) ? String(config.ownerTelegramId) : "";
}

function formattedCatalog(items) {
  return (items || []).map((item) => {
    const price = Number(item.price || 0);
    return `• ${String(item.name || "Товар").slice(0, 200)} — ${(Number.isFinite(price) ? price : 0).toLocaleString("ru-RU")} ₸`;
  });
}

async function replyLongText(ctx, text) {
  const normalized = String(text || "").trim();
  if (!normalized) return;
  for (let offset = 0; offset < normalized.length; offset += MAX_TELEGRAM_TEXT) {
    await ctx.reply(normalized.slice(offset, offset + MAX_TELEGRAM_TEXT));
  }
}

export function createWorkflowRuntime({ InlineKeyboard, Keyboard, setConversationState }) {
  if (!InlineKeyboard || !Keyboard || typeof setConversationState !== "function") {
    throw new TypeError("Workflow runtime requires Telegram keyboard adapters and setConversationState.");
  }

  async function executeFlow(ctx, record, startId, depth = 0, visited = new Set()) {
    if (depth > MAX_FLOW_DEPTH || visited.has(startId)) return;
    const workflow = record.config.workflow || createDefaultWorkflow();
    const current = workflow?.nodes?.find((node) => node.id === startId);
    if (!current) return;
    const nextVisited = new Set(visited).add(startId);
    const outgoing = (workflow.edges || []).filter((edge) => edge.source === current.id);
    const config = record.config;
    const stateKey = `${record.telegramId || record.id || "bot"}:${ctx.chat.id}`;
    const goToSingleNext = async () => {
      const targetId = firstOutgoingTarget(outgoing);
      if (targetId) await executeFlow(ctx, record, targetId, depth + 1, nextVisited);
    };
    const showChoices = async (prompt) => {
      const validEdges = outgoing.filter((edge) => workflow.nodes.some((node) => node.id === edge.target)).slice(0, MAX_CHOICES);
      if (!validEdges.length) {
        await ctx.reply(prompt || "Этот шаг пока не настроен. Владелец может добавить следующие блоки в сценарии.");
        return;
      }
      await ctx.reply(prompt || "Выберите действие:", { reply_markup: choiceKeyboard(workflow, validEdges, InlineKeyboard) });
    };

    switch (current.data.kind) {
      case "start":
      case "keyword":
        await goToSingleNext();
        break;
      case "message": {
        const text = current.id === "welcome" ? (config.greeting || current.data.text) : current.data.text;
        if (text) await replyLongText(ctx, text);
        if (outgoing.length > 1) await showChoices("Выберите, что сделать дальше:");
        else await goToSingleNext();
        break;
      }
      case "menu":
        await showChoices(current.data.text || "Выберите действие:");
        break;
      case "catalog": {
        const lines = formattedCatalog(config.items);
        await replyLongText(ctx, lines.length ? lines.join("\n") : (current.data.text || "Каталог пока не заполнен. Владелец может добавить товары или услуги в настройках бота."));
        await goToSingleNext();
        break;
      }
      case "contacts": {
        const contact = config.contacts || {};
        const details = [contact.address, contact.hours, contact.phone].filter(Boolean).join("\n");
        await replyLongText(ctx, details || current.data.text || "Контакты пока не заполнены. Напишите владельцу бота.");
        await goToSingleNext();
        break;
      }
      case "booking":
      case "question":
      case "feedback":
      case "subscribe":
      case "document": {
        const defaults = {
          booking: "Напишите, пожалуйста, что вас интересует и как с вами связаться.",
          question: "Напишите ответ сообщением, чтобы продолжить.",
          feedback: "Оцените наш сервис от 1 до 5 и напишите комментарий.",
          subscribe: "Чтобы подписаться на новости, напишите «Подписаться».",
          document: "Пришлите документ или изображение сообщением — я передам его владельцу.",
        };
        await ctx.reply(current.data.text || defaults[current.data.kind]);
        setConversationState(stateKey, { kind: current.data.kind, nodeId: current.id });
        break;
      }
      case "handoff":
      {
        await ctx.reply(current.data.text || "Напишите сообщение для оператора — владелец получит его и ответит вам.");
        setConversationState(stateKey, { kind: "handoff", nodeId: current.id });
        break;
      }
      case "notification": {
        const ownerId = ownerIdOf(config);
        if (!ownerId) {
          await ctx.reply("Уведомления владельцу пока не настроены.");
          await goToSingleNext();
          break;
        }
        const heading = current.data.text || "Новое уведомление";
        const customer = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || "Пользователь";
        await ctx.api.sendMessage(ownerId, `${heading} из @${record.username || "бота"}.\nОт: ${customer}${ctx.from?.username ? ` (@${ctx.from.username})` : ""}\nTelegram ID: ${ctx.chat.id}`);
        await ctx.reply("Передал сообщение владельцу.");
        await goToSingleNext();
        break;
      }
      case "payment":
      case "link": {
        const url = String(current.data.url || "").trim();
        if (!/^https:\/\//i.test(url)) {
          await ctx.reply(current.data.text || (current.data.kind === "payment" ? "Ссылка на оплату ещё не настроена. Владелец может добавить её в настройках блока." : "Ссылка ещё не настроена. Владелец может добавить HTTPS-ссылку в редакторе."));
        } else {
          const label = (current.data.buttonLabel || (current.data.kind === "payment" ? "Оплатить" : "Открыть")).slice(0, 64);
          await ctx.reply(current.data.text || (current.data.kind === "payment" ? "Перейдите по ссылке для оплаты:" : "Откройте страницу по кнопке:"), { reply_markup: new InlineKeyboard().url(label, url) });
        }
        await goToSingleNext();
        break;
      }
      case "condition":
        await showChoices(current.data.text || "Выберите подходящий вариант:");
        break;
      case "delay": {
        const seconds = Math.max(0, Math.min(300, Math.floor(Number(current.data.delaySeconds) || 0)));
        if (seconds) await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        if (current.data.text) await ctx.reply(current.data.text);
        else if (seconds) await ctx.reply(`Продолжаем сценарий после паузы ${seconds} сек.`);
        await goToSingleNext();
        break;
      }
      case "location":
        await ctx.reply(current.data.text || "Поделитесь геолокацией или напишите адрес текстом.", { reply_markup: new Keyboard().requestLocation("📍 Отправить геолокацию").resized().oneTime() });
        setConversationState(stateKey, { kind: "location", nodeId: current.id });
        break;
      case "fallback":
        await replyLongText(ctx, current.data.text || "Не понял запрос. Выберите пункт меню или напишите по контакту из раздела «Контакты».");
        await goToSingleNext();
        break;
      default:
        await ctx.reply("Этот шаг сценария больше не поддерживается. Владелец может заменить его в редакторе.");
    }
  }

  async function continueFromNode(ctx, record, sourceId) {
    const workflow = record.config.workflow || createDefaultWorkflow();
    const outgoing = (workflow?.edges || []).filter((edge) => edge.source === sourceId && workflow.nodes.some((node) => node.id === edge.target));
    if (outgoing.length === 1) return executeFlow(ctx, record, outgoing[0].target);
    if (outgoing.length > 1) {
      const keyboard = choiceKeyboard(workflow, outgoing.slice(0, MAX_CHOICES), InlineKeyboard);
      await ctx.reply("Выберите, что сделать дальше:", { reply_markup: keyboard });
    }
  }

  return { executeFlow, continueFromNode };
}

