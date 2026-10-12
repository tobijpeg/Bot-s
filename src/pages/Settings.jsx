import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { workspaceStorageKey } from "../workspace-storage.js";

export default function Settings() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [tourError, setTourError] = useState("");
  useEffect(() => { apiFetch("/api/health").then((response) => response.json()).then(setHealth).catch(() => setHealth({ ok: false })); }, []);

  async function restartTour() {
    setTourError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Войдите в аккаунт заново.");
      const { error } = await supabase.from("onboarding_responses").update({ tour_completed: false, updated_at: new Date().toISOString() }).eq("user_id", data.session.user.id);
      if (error) throw error;
      navigate("/overview?tour=1");
    } catch (exception) { setTourError(exception.message); }
  }

  async function clearDraft() {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    const key = workspaceStorageKey(userId);
    if (key) localStorage.removeItem(key);
    const prefix = `bots-kz-editor-draft-v1:${userId}:`;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const storageKey = localStorage.key(index);
      if (storageKey?.startsWith(prefix)) localStorage.removeItem(storageKey);
    }
    navigate("/overview");
  }

  return <div className="mx-auto max-w-5xl" data-tour-id="platform-settings"><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-700">Рабочее пространство / Настройки</p><header className="mb-5"><h1 className="font-display text-2xl font-bold text-navy-950">Настройки платформы</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">Состояние подключений и параметры рабочего пространства.</p></header><div className="grid gap-3 md:grid-cols-2"><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:col-span-2"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">⌁</span><div><h2 className="text-sm font-bold text-navy-950">Состояние сервисов</h2><p className="mt-1 text-xs text-gray-500">Ваш аккаунт хранится в Supabase, а сценарии ботов запускает сервер платформы.</p></div></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><Row label="API сервера" value={health?.ok ? "Доступен" : health ? "Не отвечает" : "Проверяем…"}/><Row label="Supabase" value={health?.supabase ? "Настроен" : "Не настроен на сервере"}/><Row label="ИИ-помощник" value={health?.ai ? "Доступен серверу" : "Сейчас недоступен"}/><Row label="Запросы к помощнику" value={health ? `${health.limit} в месяц на аккаунт` : "—"}/></dl></section><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">ⓘ</span><h2 className="text-sm font-bold text-navy-950">Экскурсия и анкета</h2></div><p className="mt-3 text-xs leading-5 text-gray-500">При первом входе сервис задаёт необязательные вопросы и показывает основные разделы. Экскурсию можно пройти повторно.</p><button onClick={restartTour} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy-950 transition hover:border-violet-200 hover:bg-violet-50">Повторить экскурсию</button>{tourError && <p role="alert" className="mt-2 text-xs text-red-700">{tourError}</p>}</section><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">🔐</span><h2 className="text-sm font-bold text-navy-950">Защита Telegram-токена</h2></div><p className="mt-3 text-xs leading-5 text-gray-500">Токен шифруется на сервере платформы до записи в базу. Ключ шифрования не передаётся браузеру.</p></section><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:col-span-2"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">▧</span><h2 className="text-sm font-bold text-navy-950">Черновики</h2></div><p className="mt-3 max-w-2xl text-xs leading-5 text-gray-500">Незавершённые данные создания и редакторские черновики хранятся в этом браузере отдельно для каждого аккаунта. Запущенные боты и библиотека сценариев хранятся в Supabase.</p><button onClick={clearDraft} className="mt-4 rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">Удалить мои черновики из браузера</button></section></div></div>;
}

function Row({ label, value }) { return <div className="flex flex-col justify-between gap-1 sm:flex-row"><dt className="text-gray-500">{label}</dt><dd className="font-medium text-navy-950">{value}</dd></div>; }
