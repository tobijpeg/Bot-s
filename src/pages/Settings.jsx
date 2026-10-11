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
    const key = workspaceStorageKey(data.session?.user?.id);
    if (key) localStorage.removeItem(key);
    window.location.reload();
  }

  return <div className="max-w-4xl" data-tour-id="platform-settings"><p className="mb-4 text-sm text-gray-400">Рабочее пространство / <span className="text-gray-600">Настройки</span></p><div className="rounded-2xl bg-white p-7 shadow-sm sm:p-9"><h1 className="font-display text-2xl font-bold text-navy-950">Службы платформы</h1><p className="mt-2 text-sm leading-6 text-gray-500">Ваши аккаунт и рабочие данные хранятся в Supabase. Сервер платформы выполняет сценарии Telegram-ботов и помогает настраивать их с помощью ИИ.</p><section className="mt-7 border-t border-gray-100 pt-6"><h2 className="text-sm font-semibold text-navy-950">Состояние</h2><dl className="mt-4 space-y-3 text-sm"><Row label="API сервера" value={health?.ok ? "Доступен" : health ? "Не отвечает" : "Проверяем…"}/><Row label="Supabase" value={health?.supabase ? "Настроен" : "Не настроен на сервере"}/><Row label="Помощник конструктора" value={health?.ai ? "Доступен серверу" : "Сейчас недоступен"}/><Row label="Запросы к помощнику" value={health ? `${health.limit} в месяц на аккаунт` : "—"}/></dl></section><section className="mt-7 border-t border-gray-100 pt-6"><h2 className="text-sm font-semibold text-navy-950">Ваши данные и подсказки</h2><p className="mt-2 text-xs leading-5 text-gray-500">При первом входе сервис задаёт несколько необязательных вопросов и показывает экскурсию по основным разделам. Экскурсию можно пройти повторно.</p><button onClick={restartTour} className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-gray-50">Повторить экскурсию</button>{tourError && <p role="alert" className="mt-2 text-xs text-red-700">{tourError}</p>}</section><section className="mt-7 border-t border-gray-100 pt-6"><h2 className="text-sm font-semibold text-navy-950">Защита Telegram-токена</h2><p className="mt-2 text-xs leading-5 text-gray-500">Токен шифруется на сервере платформы до записи в базу. Ключ шифрования не передаётся браузеру.</p></section><section className="mt-7 border-t border-gray-100 pt-6"><h2 className="text-sm font-semibold text-navy-950">Черновик конструктора</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">Временные незавершённые данные создания бота сохраняются в этом браузере отдельно для каждого аккаунта; запущенные боты и библиотека сценариев хранятся в Supabase.</p><button onClick={clearDraft} className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Удалить мой черновик из браузера</button></section></div></div>;
}

function Row({ label, value }) { return <div className="flex flex-col justify-between gap-1 sm:flex-row"><dt className="text-gray-500">{label}</dt><dd className="font-medium text-navy-950">{value}</dd></div>; }
