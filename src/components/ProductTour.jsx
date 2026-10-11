import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const steps = [
  { path: "/overview", target: "overview-content", title: "Обзор", body: "Здесь собраны первые шаги и основные сведения о вашем рабочем пространстве." },
  { path: "/create/token", target: "create-token", title: "Подключите Telegram-бота", body: "Создайте бота через BotFather и введите его токен. Он будет зашифрован и останется на сервере платформы." },
  { path: "/create/describe", target: "business-description", title: "Расскажите о задаче", body: "Опишите бизнес и путь клиента. Можно взять базовый пример или продолжить со своей структурой без шаблона." },
  { path: "/create/flow", target: "scenario-editor", title: "Соберите сценарий", body: "Добавляйте шаги, соединяйте их и настраивайте тексты. Ваша библиотека процессов поможет повторно использовать свои решения." },
  { path: "/bots", target: "my-bots", title: "Управляйте ботами", body: "Открывайте, запускайте, останавливайте и редактируйте подключённых Telegram-ботов." },
  { path: "/inbox", target: "inbox-view", title: "Отвечайте клиентам", body: "Смотрите заявки, переписки и отправленные файлы. Ответ из кабинета отправляется человеку через нужного бота." },
  { path: "/settings", target: "platform-settings", title: "Состояние сервиса", body: "Здесь можно проверить доступность серверных служб и посмотреть основные настройки платформы." },
];

export default function ProductTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [saving, setSaving] = useState(false);
  const active = new URLSearchParams(location.search).get("tour") === "1";
  const current = steps[stepIndex];

  useEffect(() => {
    if (!active) { setTargetRect(null); setStepIndex(0); return undefined; }
    if (location.pathname !== current.path) {
      navigate(`${current.path}?tour=1`, { replace: true });
      return undefined;
    }
    let frame = requestAnimationFrame(() => {
      const element = document.querySelector(`[data-tour-id="${current.target}"]`);
      if (element) setTargetRect(element.getBoundingClientRect().toJSON());
      else setTargetRect(null);
    });
    const update = () => {
      const element = document.querySelector(`[data-tour-id="${current.target}"]`);
      if (element) setTargetRect(element.getBoundingClientRect().toJSON());
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [active, current, location.pathname, navigate]);

  async function closeTour() {
    setSaving(true);
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) await supabase.from("onboarding_responses").update({ tour_completed: true, updated_at: new Date().toISOString() }).eq("user_id", data.session.user.id);
      }
    } catch (error) { console.error("Failed to save product tour state:", error); }
    finally { window.dispatchEvent(new Event("bots:tour-completed")); setSaving(false); navigate("/overview", { replace: true }); }
  }

  function next() {
    if (stepIndex === steps.length - 1) { closeTour(); return; }
    setTargetRect(null); setStepIndex((currentStep) => currentStep + 1);
  }

  if (!active) return null;
  const left = targetRect ? Math.max(12, Math.min(targetRect.left, window.innerWidth - 360)) : Math.max(12, window.innerWidth - 360);
  const below = targetRect ? targetRect.bottom + 14 : 100;
  const top = below + 210 < window.innerHeight ? below : Math.max(12, (targetRect?.top || 250) - 225);

  return <>
    {targetRect && <div aria-hidden="true" style={{ position: "fixed", zIndex: 40, left: targetRect.left - 4, top: targetRect.top - 4, width: targetRect.width + 8, height: targetRect.height + 8, border: "2px solid #7c3aed", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(15,23,42,.16)", pointerEvents: "none" }} />}
    <section role="dialog" aria-label="Экскурсия по сервису" className="fixed z-50 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-violet-100 bg-white p-5 shadow-2xl" style={{ left, top }}><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Шаг {stepIndex + 1} из {steps.length}</p><button onClick={closeTour} disabled={saving} className="text-xs font-semibold text-gray-500 hover:text-gray-800">Пропустить экскурсию</button></div><h2 className="mt-3 text-base font-bold text-navy-950">{current.title}</h2><p className="mt-2 text-sm leading-6 text-gray-600">{current.body}</p><div className="mt-4 flex justify-between"><button onClick={closeTour} disabled={saving} className="text-xs font-medium text-gray-500">{saving ? "Сохраняю…" : "Пропустить всё"}</button><button onClick={next} disabled={saving} className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white">{stepIndex === steps.length - 1 ? "Начать работу" : "Далее"}</button></div></section>
  </>;
}
