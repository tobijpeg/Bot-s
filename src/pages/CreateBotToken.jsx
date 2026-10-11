import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateBotProgress from "../components/CreateBotProgress.jsx";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { supabase, supabaseSetupError } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";

export default function CreateBotToken() {
  const navigate = useNavigate();
  const { botUsername, setField } = useCreateBot();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setError("");
    if (!/^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(token.trim())) { setError("Проверьте формат токена: он содержит двоеточие и длинную буквенно-цифровую часть."); return; }
    setLoading(true);
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Войдите в аккаунт Supabase, затем подключите бота.");
      const response = await apiFetch("/api/bots/connect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ token: token.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось подключить Telegram-бота.");
      if (!data.bot?.id) throw new Error("Бот не сохранён. Проверьте, что backend платформы развернут и миграция Supabase применена.");
      setField("botId", data.bot.id); setField("botUsername", data.bot.username); setField("botName", data.bot.botName); setField("verified", true); setField("status", "Подключён"); setToken(""); navigate("/create/describe");
    } catch (exception) { setError(exception instanceof TypeError ? "Сервер платформы сейчас не отвечает. Попробуйте позже." : exception.message); }
    finally { setLoading(false); }
  }
  return <div><CreateBotProgress /><div className="grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_.8fr]" data-tour-id="create-token"><section className="rounded-2xl bg-white p-7 shadow-sm sm:p-9"><p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Сначала подключим Telegram</p><h1 className="mt-3 font-display text-2xl font-bold text-navy-950 sm:text-3xl">Подключите бота через BotFather</h1><p className="mt-3 text-sm leading-6 text-gray-500">Токен отправляется серверу платформы по защищённому соединению и сохраняется в зашифрованном виде. Пользователю не нужно держать компьютер включённым: бот работает на сервере платформы.</p><ol className="mt-7 space-y-4">{[<>Открой <a className="font-semibold text-accent-600 hover:underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> и отправь команду <code className="rounded bg-gray-100 px-1.5 py-0.5 text-navy-950">/newbot</code>.</>, <>Задай имя и уникальный username, который заканчивается на <code className="rounded bg-gray-100 px-1.5 py-0.5 text-navy-950">bot</code>.</>, <>Скопируй API-токен и вставь его ниже.</>].map((item, index) => <li key={index} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-xs font-bold text-accent-600">{index + 1}</span><span className="text-sm text-gray-600">{item}</span></li>)}</ol><label className="mt-7 block"><span className="mb-2 block text-sm font-semibold text-navy-950">Токен бота</span><input value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") connect(); }} autoComplete="off" spellCheck="false" placeholder="123456789:AA..." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-navy-950 outline-none focus:border-accent-500" /></label>{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-700">{error}</p>}<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><button onClick={connect} disabled={loading || !token.trim()} className="rounded-xl bg-navy-950 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50">{loading ? "Проверяем в Telegram…" : "Проверить и продолжить"}</button><span className="text-xs text-gray-400">Токен не сохраняется в браузере</span></div>{botUsername && <p className="mt-4 text-xs text-gray-500">Ранее подключён: @{botUsername}</p>}</section><aside className="h-fit rounded-2xl border border-blue-100 bg-blue-50 p-6"><p className="text-sm font-semibold text-navy-950">🔐 Защита данных</p><p className="mt-2 text-sm leading-6 text-gray-600">Токен шифруется на сервере платформы и не раскрывается в браузере.</p><div className="mt-5 rounded-xl bg-white/80 p-4"><p className="text-xs font-semibold text-navy-950">ИИ-помощник конструктора</p><p className="mt-1 text-xs leading-5 text-gray-500">Описание бизнеса обрабатывает серверный ИИ-помощник конструктора.</p></div></aside></div></div>;
}
