import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import { supabase, supabaseSetupError } from "../lib/supabase.js";

async function authorizedFetch(path, options = {}) {
  if (!supabase) throw new Error(supabaseSetupError());
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Войдите в аккаунт заново.");
  return apiFetch(path, { ...options, headers: { Authorization: `Bearer ${data.session.access_token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
}

const formatTime = (value) => new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [filterBot, setFilterBot] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadConversations = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const response = await authorizedFetch("/api/inbox");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить входящие.");
      setConversations(result.conversations || []);
      setError("");
      setLastRefresh(Date.now());
      setSelectedId((current) => current || result.conversations?.[0]?.id || "");
    } catch (exception) { setError(exception.message); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (id, quiet = false) => {
    if (!id) { setMessages([]); return; }
    try {
      if (!quiet) setLoadingMessages(true);
      const response = await authorizedFetch(`/api/inbox/${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось открыть переписку.");
      setMessages(result.messages || []);
    } catch (exception) { setError(exception.message); }
    finally { if (!quiet) setLoadingMessages(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return undefined; }
    loadMessages(selectedId);
    const timer = window.setInterval(() => { loadConversations(true); loadMessages(selectedId, true); }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadConversations, loadMessages]);

  const selected = conversations.find((conversation) => conversation.id === selectedId);
  const botOptions = useMemo(() => [...new Map(conversations.map((conversation) => [conversation.bot_id, { id: conversation.bot_id, username: conversation.username }])).values()], [conversations]);
  const visibleConversations = conversations.filter((conversation) => filterBot === "all" || conversation.bot_id === filterBot);

  async function sendReply(event) {
    event.preventDefault();
    if (!draft.trim() || !selectedId) return;
    setSending(true); setError("");
    try {
      const response = await authorizedFetch(`/api/inbox/${selectedId}/reply`, { method: "POST", body: JSON.stringify({ text: draft.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось отправить ответ.");
      setMessages((current) => [...current, result.message]); setDraft(""); loadConversations(true);
    } catch (exception) { setError(exception.message); }
    finally { setSending(false); }
  }

  return <div className="mx-auto max-w-7xl" data-tour-id="inbox-view">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-sm text-gray-400">Профиль / <span className="text-gray-600">Входящие</span></p><h1 className="font-display text-2xl font-bold text-navy-950">Входящие обращения</h1><p className="mt-1 text-sm text-gray-500">Сообщения, заявки и файлы от пользователей ваших Telegram-ботов.</p></div><div className="flex items-center gap-3"><span className="text-xs text-gray-400">{conversations.reduce((sum, conversation) => sum + Number(conversation.unread_count || 0), 0)} непрочитанных · обновлено {lastRefresh ? formatTime(lastRefresh) : "—"}</span><button onClick={() => loadConversations()} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Обновить</button></div></div>
    {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid min-h-[68vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-gray-100 md:border-b-0 md:border-r"><div className="border-b border-gray-100 p-3"><label className="sr-only" htmlFor="inbox-bot-filter">Фильтр по боту</label><select id="inbox-bot-filter" value={filterBot} onChange={(event) => setFilterBot(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"><option value="all">Все боты</option>{botOptions.map((bot) => <option key={bot.id} value={bot.id}>@{bot.username}</option>)}</select></div><div className="max-h-[32vh] overflow-y-auto md:max-h-none md:flex-1">{loading ? <p className="p-5 text-sm text-gray-400">Загружаем обращения…</p> : visibleConversations.length ? visibleConversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-gray-50 p-4 text-left hover:bg-slate-50 ${selectedId === conversation.id ? "bg-violet-50" : ""}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold text-navy-950">{conversation.display_name}</span><span className="flex shrink-0 items-center gap-2"><time className="text-[10px] text-gray-400">{formatTime(conversation.last_message_at)}</time>{Number(conversation.unread_count) > 0 && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>}</span></div><p className="mt-1 text-[11px] text-gray-400">@{conversation.username} · {conversation.customer_username ? `@${conversation.customer_username}` : "Telegram"}</p><p className="mt-2 truncate text-xs text-gray-600">{conversation.last_kind === "document" ? "📎 " : conversation.last_kind === "photo" ? "🖼️ " : ""}{conversation.last_text || "Вложение"}</p></button>) : <div className="p-5"><p className="text-sm font-medium text-slate-700">Обращений пока нет</p><p className="mt-2 text-xs leading-5 text-gray-500">Когда клиент напишет боту, оставит заявку или отправит файл, переписка появится здесь.</p></div>}</div></aside>
      <section className="flex min-h-[55vh] flex-col md:min-h-0">{selected ? <><header className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-semibold text-navy-950">{selected.display_name}</h2><p className="mt-1 text-xs text-gray-500">{selected.customer_username ? `@${selected.customer_username} · ` : ""}бот @{selected.username} · ID {selected.telegram_chat_id}</p></div><Link to={`/bots/${selected.bot_id}/edit`} className="text-xs font-semibold text-accent-600 hover:underline">Настроить бота</Link></header><div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-5">{loadingMessages ? <p className="text-sm text-gray-400">Открываем переписку…</p> : messages.map((message) => <article key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.direction === "outbound" ? "ml-auto bg-violet-600 text-white" : message.kind === "system" ? "mx-auto bg-amber-50 text-amber-900" : "bg-white text-slate-800"}`}><p className="whitespace-pre-wrap break-words">{message.text || (message.kind === "document" ? "Документ" : "Сообщение")}</p>{["document", "photo"].includes(message.kind) && <a href={`/api/inbox/files/${message.id}`} onClick={async (event) => { event.preventDefault(); try { const response = await authorizedFetch(`/api/inbox/files/${message.id}`); if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Не удалось скачать файл."); } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = message.file_name || "telegram-file"; link.click(); URL.revokeObjectURL(url); } catch (exception) { setError(exception.message); } }} className={`mt-2 inline-block text-xs font-semibold underline ${message.direction === "outbound" ? "text-white" : "text-violet-700"}`}>Скачать {message.file_name || (message.kind === "photo" ? "фото" : "файл")}</a>}<time className={`mt-2 block text-right text-[10px] ${message.direction === "outbound" ? "text-violet-100" : "text-gray-400"}`}>{formatTime(message.created_at)}</time></article>)}</div><form onSubmit={sendReply} className="flex gap-2 border-t border-gray-100 p-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={2} placeholder="Напишите ответ клиенту…" className="min-w-0 flex-1 resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"/><button disabled={sending || !draft.trim()} className="self-end rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? "Отправляем…" : "Ответить"}</button></form></> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="text-4xl">✉️</div><h2 className="mt-4 font-semibold text-navy-950">Выберите переписку</h2><p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">В этом разделе появятся обращения из Telegram. Отвечайте клиентам здесь — ответ уйдёт через их бота.</p></div>}</section>
    </div>
  </div>;
}
