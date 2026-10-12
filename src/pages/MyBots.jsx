import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { supabase, supabaseSetupError } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";

export default function MyBots() {
  const { botUsername, botName, status, category, templates, description, features, setField } = useCreateBot();
  const [serverOnline, setServerOnline] = useState(false);
  const [bots, setBots] = useState([]);
  const [startingBotId, setStartingBotId] = useState("");
  const [stoppingBotId, setStoppingBotId] = useState("");
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: session } = await supabase.auth.getSession();
      const response = await apiFetch("/api/bots", { headers: { Authorization: `Bearer ${session.session?.access_token || ""}` } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Не удалось загрузить ботов.");
      return result;
    }).then((data) => {
      if (!active) return;
      setServerOnline(true);
      setBots(data.bots || []);
      const bot = data.bots?.find((item) => item.username === botUsername);
      if (bot) setField("status", bot.status);
    }).catch(() => { if (active) setServerOnline(false); });
    return () => { active = false; };
  }, [botUsername, setField]);
  const activeStatus = status === "Работает на сервере платформы";

  async function startBot(bot) {
    setStartingBotId(bot.id); setActionError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Войдите в аккаунт заново.");
      const response = await apiFetch(`/api/bots/${bot.id}/launch`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(bot.config || {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось запустить бота.");
      setBots((current) => current.map((item) => item.id === bot.id ? { ...item, status: result.bot.status, config: result.bot.config || item.config } : item));
      if (bot.username === botUsername) setField("status", result.bot.status);
    } catch (exception) { setActionError(exception.message); }
    finally { setStartingBotId(""); }
  }

  async function stopBot(bot) {
    setStoppingBotId(bot.id); setActionError("");
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Войдите в аккаунт заново.");
      const response = await apiFetch(`/api/bots/${bot.id}/stop`, { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось остановить бота.");
      const stoppedStatus = result.bot?.status || "Остановлен";
      setBots((current) => current.map((item) => item.id === bot.id ? { ...item, status: stoppedStatus } : item));
      if (bot.username === botUsername) setField("status", stoppedStatus);
    } catch (exception) { setActionError(exception.message); }
    finally { setStoppingBotId(""); }
  }

  return <div data-tour-id="my-bots">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-700">Рабочее пространство / Боты</p><h1 className="font-display text-2xl font-bold text-navy-950">Мои Telegram-боты</h1><p className="mt-1 text-sm text-gray-500">Запускайте, проверяйте и настраивайте ботов компании.</p></div><Link to="/create/token" className="rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-900">＋ Создать бота</Link></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Подключено ботов" value={bots.length} icon="◉"/><Metric label="Работают сейчас" value={bots.filter((bot) => bot.status === "Работает на сервере платформы").length} icon="●" tone="green"/><Metric label="Черновик" value={status === "Черновик" ? "Есть" : "—"} icon="▧"/><Metric label="Состояние сервера" value={serverOnline ? "Онлайн" : "Проверяем"} icon="⌁" tone={serverOnline ? "green" : "amber"}/></section>
    {actionError && <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
    {!serverOnline && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-semibold text-amber-950">Сервер пока не отвечает</p><p className="mt-1 text-sm text-amber-900">Список обновится, когда backend и Supabase будут доступны.</p></div>}
    {serverOnline && bots.length === 0 && <section className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-violet-200 bg-white px-6 py-12 text-center shadow-sm"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-2xl text-violet-700">✦</span><h2 className="mt-4 font-display text-lg font-bold text-navy-950">Подключённых ботов пока нет</h2><p className="mt-2 max-w-md text-sm leading-6 text-gray-500">Добавьте токен из BotFather, расскажите о бизнесе и соберите свой сценарий с помощью ИИ.</p><Link to="/create/token" className="mt-5 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">Создать первого бота</Link></section>}
    {bots.length > 0 && <section className="mt-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-950">Подключённые боты</h2><p className="mt-1 text-xs text-gray-500">Редактирование открывает сохранённый сценарий и настройки.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">{bots.length} всего</span></div><div className="grid gap-3 xl:grid-cols-2">{bots.map((bot) => { const isRunning = bot.status === "Работает на сервере платформы"; const isStarting = startingBotId === bot.id; const isStopping = stoppingBotId === bot.id; return <article key={bot.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${isRunning ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>✦</span><div className="min-w-0"><h3 className="truncate text-sm font-bold text-navy-950">{bot.botName || "Telegram-бот"}</h3><p className="mt-1 truncate text-xs text-gray-500">@{bot.username}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isRunning ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><span className="mr-1">●</span>{isRunning ? "Работает" : bot.status || "Остановлен"}</span></div><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{isRunning ? <button onClick={() => stopBot(bot)} disabled={Boolean(stoppingBotId)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{isStopping ? "Останавливаю…" : "Остановить"}</button> : <button onClick={() => startBot(bot)} disabled={Boolean(startingBotId)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{isStarting ? "Запускаю…" : "Запустить"}</button>}<Link to={`/bots/${bot.id}/edit`} className="rounded-lg bg-navy-950 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-900">Настроить сценарий</Link><a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer" className="ml-auto rounded-lg px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">Открыть в Telegram ↗</a></div></article>; })}</div></section>}
    {(botUsername || botName) && <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Черновик конструктора</p><h2 className="mt-1 text-sm font-bold text-navy-950">{botName || "Последняя настройка"} {botUsername && <span className="font-normal text-gray-500">@{botUsername}</span>}</h2></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${activeStatus ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{activeStatus ? "Активен" : status || "Черновик"}</span></div><div className="mt-3 grid gap-2 md:grid-cols-2"><p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{description || "Добавьте описание компании, чтобы персонализировать сценарий."}</p><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">{templates[category]?.emoji} {templates[category]?.label || "Своя структура"}</p><p className="mt-1 text-xs leading-5 text-gray-500">{features.join(" · ")}</p></div></div></section>}
  </div>;
}

function Metric({ label, value, icon, tone = "violet" }) { const colors = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"; return <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${colors}`}>{icon}</span></div><p className="mt-3 text-xl font-bold text-navy-950">{value}</p></article>; }

