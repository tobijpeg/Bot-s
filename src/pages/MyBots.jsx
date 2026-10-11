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
  const handle = botUsername ? `@${botUsername}` : "Бот не подключён";
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

  return (
    <div data-tour-id="my-bots">
      <p className="mb-4 text-sm text-gray-400">
        Мои боты / <span className="text-gray-600">{handle}</span>
      </p>

      <div className={`flex items-center gap-3 rounded-xl2 px-5 py-4 ${activeStatus ? "bg-green-50" : "bg-amber-50"}`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs text-white ${activeStatus ? "bg-green-500" : "bg-amber-500"}`}>
          {activeStatus ? "✓" : "·"}
        </span>
        <div>
          <p className="text-sm font-semibold text-navy-950">
          {activeStatus ? "Бот отвечает в Telegram" : status || "Черновик конструктора"}
          </p>
          <p className="text-xs text-gray-500">{botName ? `${botName} · ${handle}` : "Создайте своего первого бота"}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr_1fr_1.3fr]">
        {}
        <div className="rounded-xl2 bg-white p-5 shadow-sm md:col-span-4">
          <p className="mb-3 text-xs font-medium text-gray-400">
            Предпросмотр в Telegram
          </p>
          <div className="mb-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-navy-950">
            {description || "Расскажите о бизнесе на шаге создания — здесь появится персональное приветствие."}
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-navy-950">
            {templates[category]?.emoji} {templates[category]?.label} · {features.join(" · ")}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        {botUsername && <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="rounded-lg bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-900">Открыть @{botUsername} в Telegram</a>}
        {activeStatus && <button onClick={() => { const bot = bots.find((item) => item.username === botUsername); if (bot) stopBot(bot); }} disabled={Boolean(stoppingBotId)} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-gray-50 disabled:opacity-50">{stoppingBotId ? "Останавливаю…" : "Остановить бота"}</button>}
      </div>

      {actionError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {bots.length > 0 && <section className="mt-6"><h2 className="mb-3 font-display text-lg font-bold text-navy-950">Подключённые боты</h2><div className="grid gap-3 md:grid-cols-2">{bots.map((bot) => { const isRunning = bot.status === "Работает на сервере платформы"; return <article key={bot.id} className="flex items-center justify-between gap-3 rounded-xl2 border border-gray-100 bg-white p-4 shadow-sm"><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-950">{bot.botName} <span className="font-normal text-gray-500">@{bot.username}</span></p><p className="mt-1 text-xs text-gray-400">{bot.status}</p></div><div className="flex shrink-0 gap-2">{isRunning ? <button onClick={() => stopBot(bot)} disabled={Boolean(stoppingBotId)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{stoppingBotId === bot.id ? "Останавливаю…" : "Остановить"}</button> : <button onClick={() => startBot(bot)} disabled={Boolean(startingBotId)} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{startingBotId === bot.id ? "Запускаю…" : "Запустить"}</button>}<Link to={`/bots/${bot.id}/edit`} className="rounded-lg bg-navy-950 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-900">Редактировать</Link></div></article>; })}</div></section>}
      {!serverOnline && <div className="mt-6 rounded-xl2 border border-amber-100 bg-amber-50 p-5"><p className="text-sm font-semibold text-amber-950">Не удалось загрузить список ботов</p><p className="mt-1 text-sm leading-6 text-amber-900">Проверьте доступность серверного API и подключение Supabase.</p></div>}
    </div>
  );
}

