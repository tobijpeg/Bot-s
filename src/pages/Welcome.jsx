import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseSetupError } from "../lib/supabase.js";

const featureOptions = ["Запись и бронирование", "Заявки и заказы", "Каталог и оплата", "Документы и файлы", "Ответы на частые вопросы", "Уведомления", "Свои процессы и сценарии", "Статистика и отчёты"];
const personas = [["business", "Владелец бизнеса"], ["employee", "Работаю в компании"], ["student", "Студент или учащийся"], ["freelancer", "Самозанятый специалист"], ["other", "Другое"]];
const purposes = [["customer_service", "Помогать клиентам"], ["operations", "Упростить работу команды"], ["sales", "Принимать заказы и заявки"], ["learn", "Изучить возможности сервиса"], ["other", "Другая задача"]];

export default function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState("business");
  const [purpose, setPurpose] = useState("customer_service");
  const [industry, setIndustry] = useState("");
  const [plannedUse, setPlannedUse] = useState("");
  const [willDevelop, setWillDevelop] = useState("");
  const [desiredFeatures, setDesiredFeatures] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleFeature(value) { setDesiredFeatures((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }
  function skipQuestion() {
    if (step === 0) { setPersona("other"); setIndustry(""); }
    if (step === 1) { setPurpose("other"); setPlannedUse(""); }
    if (step === 2) { setDesiredFeatures([]); setWillDevelop(""); setNotes(""); finish(false); return; }
    setStep((current) => current + 1);
  }

  async function finish(skipped = false) {
    setBusy(true); setError("");
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Сессия завершилась. Войдите в аккаунт ещё раз.");
      const { error: saveError } = await supabase.from("onboarding_responses").upsert({
        user_id: data.session.user.id,
        email: data.session.user.email || "",
        persona: skipped ? "other" : persona,
        industry: skipped ? "" : industry.trim().slice(0, 100),
        purpose: skipped ? "" : purpose,
        planned_use: skipped ? "" : plannedUse.trim().slice(0, 300),
        will_develop: !skipped && willDevelop === "yes",
        desired_features: skipped ? [] : desiredFeatures,
        notes: skipped ? "" : notes.trim().slice(0, 500),
        skipped,
        tour_completed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      window.dispatchEvent(new Event("bots:onboarding-completed"));
      navigate("/overview?tour=1");
    } catch (exception) { setError(`Не получилось сохранить ответы: ${exception.message}`); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Добро пожаловать</p><h1 className="mt-2 font-display text-2xl font-bold text-navy-950">Давайте настроим сервис под вас</h1><p className="mt-2 text-sm leading-6 text-gray-500">Ответьте на несколько коротких вопросов — это поможет нам понять, какие инструменты вам нужны.</p></div><section className="rounded-2xl bg-white p-6 shadow-sm sm:p-9"><div className="mb-7 flex items-center justify-between"><p className="text-xs font-medium text-gray-400">Шаг {step + 1} из 3</p><button onClick={() => finish(true)} disabled={busy} className="text-xs font-semibold text-gray-500 hover:text-navy-950">Пропустить анкету</button></div>
    {step === 0 && <div><h2 className="text-lg font-bold text-navy-950">Чем вы занимаетесь?</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{personas.map(([value, label]) => <Choice key={value} selected={persona === value} onClick={() => setPersona(value)}>{label}</Choice>)}</div><label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Сфера или отрасль — по желанию</span><input value={industry} onChange={(event) => setIndustry(event.target.value)} maxLength={100} placeholder="Например: салон красоты, образование, ремонт" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm"/></label></div>}
    {step === 1 && <div><h2 className="text-lg font-bold text-navy-950">Для чего вы хотите использовать сервис?</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{purposes.map(([value, label]) => <Choice key={value} selected={purpose === value} onClick={() => setPurpose(value)}>{label}</Choice>)}</div><label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Опишите задачу своими словами — необязательно</span><textarea value={plannedUse} onChange={(event) => setPlannedUse(event.target.value)} maxLength={300} rows={3} placeholder="Например: хочу принимать заявки на ремонт техники" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm"/></label></div>}
    {step === 2 && <div><h2 className="text-lg font-bold text-navy-950">Что для вас особенно важно?</h2><p className="mt-1 text-sm text-gray-500">Выберите любые подходящие возможности.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{featureOptions.map((feature) => <button type="button" key={feature} onClick={() => toggleFeature(feature)} className={`rounded-xl border px-3 py-3 text-left text-sm ${desiredFeatures.includes(feature) ? "border-violet-500 bg-violet-50 text-violet-900" : "border-gray-200 text-gray-700"}`}>{desiredFeatures.includes(feature) ? "✓ " : "＋ "}{feature}</button>)}</div><fieldset className="mt-5"><legend className="text-xs font-semibold text-gray-600">Планируете сами разрабатывать сценарии ботов?</legend><div className="mt-2 flex flex-wrap gap-2">{[["yes", "Да"], ["no", "Нет"], ["maybe", "Пока не знаю"]].map(([value, label]) => <Choice key={value} selected={willDevelop === value} onClick={() => setWillDevelop(value)}>{label}</Choice>)}</div></fieldset><label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Чего вам не хватает? Идеи и пожелания — необязательно</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} placeholder="Напишите, какие функции хотелось бы увидеть…" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm"/></label></div>}
    <p className="mt-5 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">Ответы и email аккаунта видны только администратору сервиса и используются для планирования функций. Не указывайте пароли и другие конфиденциальные данные.</p>{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex items-center justify-between"><button onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || busy} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:invisible">Назад</button><div className="flex gap-2"><button onClick={skipQuestion} disabled={busy} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600">Пропустить вопрос</button><button onClick={() => step < 2 ? setStep((current) => current + 1) : finish(false)} disabled={busy} className="rounded-lg bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Сохраняю…" : step < 2 ? "Далее" : "Готово"}</button></div></div>
  </section></div>;
}

function Choice({ selected, onClick, children }) { return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${selected ? "border-accent-500 bg-accent-500/5 text-accent-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>{selected ? "✓ " : ""}{children}</button>; }
