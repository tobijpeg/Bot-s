import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CreateBotProgress from "../components/CreateBotProgress.jsx";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { supabase, supabaseSetupError } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";

export default function CreateBotLaunch() {
  const navigate = useNavigate();
  const { botId, botUsername, category, templates, features, items, contacts, ownerTelegramId, description, businessName, greeting, status, workflow, setField } = useCreateBot();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  async function launch() {
    if (!botId) { setError("Сначала подключи бота в шаге 1."); return; }
    if (!supabase) { setError(supabaseSetupError()); return; }
    setLaunching(true); setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Сессия Supabase истекла. Войдите заново.");
      // The visual editor stores the graph in the shared creation context. Include
      // it in the launch request or the server will start its default scenario.
      const config = { businessName, template: templates[category]?.label || "Своя структура", description, greeting, features, items, contacts, ownerTelegramId, workflow };
      const response = await apiFetch(`/api/bots/${botId}/launch`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify(config) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось запустить бота.");
      setField("status", result.bot.status); navigate("/bots");
    } catch (exception) { setError(exception instanceof TypeError ? "Сервер платформы сейчас не отвечает. Попробуйте позже." : exception.message); }
    finally { setLaunching(false); }
  }

  return <div><CreateBotProgress /><div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_330px]"><section className="rounded-2xl bg-white p-7 shadow-sm sm:p-9"><p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Последний шаг</p><h1 className="mt-2 font-display text-2xl font-bold text-navy-950">Проверь и запусти своего бота</h1><p className="mt-2 text-sm leading-6 text-gray-500">Настройки сохраняются в Supabase. Сервер платформы запускает сценарий Telegram-бота.</p><dl className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-100 px-4"><Row label="Telegram-бот" value={botUsername ? `@${botUsername}` : "Не подключён"} /><Row label="Основа сценария" value={category === "custom" ? "Своя структура без шаблона" : `${templates[category]?.emoji || ""} ${templates[category]?.label || "Своя структура"}`} /><Row label="Функции" value={features.join(", ") || "Не выбраны"} /><Row label="Позиции каталога" value={`${items.length} · ₸`} /><Row label="Языки" value={contacts.language || "Русский и казахский"} /><Row label="Состояние" value={status} /></dl><div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-sm font-semibold text-navy-950">ИИ не отвечает клиентам</p><p className="mt-1 text-xs leading-5 text-gray-600">Клиентские сообщения идут по соединённым блокам, кнопкам и ключевым словам. ИИ используется только здесь, в конструкторе. Бот работает на сервере платформы, пользователю не нужно запускать приложение.</p></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-between"><button onClick={() => navigate("/create/setup")} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-gray-50">Назад</button><button onClick={launch} disabled={launching || !botId} className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50">{launching ? "Запускаю…" : "Сохранить и запустить бота"}</button></div><p className="mt-3 text-center text-xs text-gray-400">Сценарий работает на сервере платформы.</p></section><aside className="h-fit rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">✦</span><p className="text-sm font-semibold text-navy-950">Помощник конструктора</p></div><div className="mt-4 rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Работает на сервере платформы</p><p className="mt-2 text-xs leading-5 text-gray-500">Он помогает вам создавать и настраивать сценарии. Сообщения клиентов обрабатываются по заданным вами правилам.</p></div><Link className="mt-4 inline-block text-xs font-semibold text-accent-600 hover:underline" to="/settings">Состояние служб платформы →</Link></aside></div></div>;
}

function Row({ label, value }) { return <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-xs text-gray-400">{label}</dt><dd className="text-sm font-medium text-navy-950">{value}</dd></div>; }
