import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseSetupError } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";

const personaLabels = { business: "Владелец бизнеса", employee: "Сотрудник компании", student: "Студент", freelancer: "Самозанятый", other: "Другое" };
const purposeLabels = { customer_service: "Помогать клиентам", operations: "Упростить работу команды", sales: "Принимать заявки и заказы", learn: "Изучить сервис", other: "Другое" };

export default function AdminResponses() {
  const [responses, setResponses] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data } = await supabase.auth.getSession();
      const response = await apiFetch("/api/admin/onboarding", { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить ответы.");
      return result.responses || [];
    }).then((rows) => { if (active) setResponses(rows); }).catch((exception) => { if (active) setError(exception.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => responses.filter((item) => `${item.email} ${item.industry} ${item.planned_use} ${item.notes}`.toLowerCase().includes(filter.toLowerCase())), [responses, filter]);
  const developers = responses.filter((item) => item.will_develop).length;
  const businessOwners = responses.filter((item) => item.persona === "business").length;
  const requestedFeatures = [...new Set(responses.flatMap((item) => item.desired_features || []))].map((feature) => ({ feature, count: responses.filter((item) => item.desired_features?.includes(feature)).length })).sort((a, b) => b.count - a.count);

  return <div className="mx-auto max-w-6xl"><p className="mb-3 text-sm text-gray-400">Платформа / <span className="text-gray-600">Ответы пользователей</span></p><h1 className="font-display text-2xl font-bold text-navy-950">Потребности пользователей</h1><p className="mt-1 text-sm text-gray-500">Ответы анкеты новых аккаунтов. Эти данные доступны только администратору сервиса.</p>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!error && <><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Ответов" value={responses.length}/><Metric label="Владельцев бизнеса" value={businessOwners}/><Metric label="Планируют собирать сценарии" value={developers}/></div><div className="mt-5 rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold text-navy-950">Часто выбираемые возможности</h2><div className="mt-3 flex flex-wrap gap-2">{requestedFeatures.length ? requestedFeatures.map(({ feature, count }) => <span key={feature} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs text-violet-900">{feature} · {count}</span>) : <span className="text-xs text-gray-400">Пока нет ответов</span>}</div></div><div className="mt-5 rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-navy-950">Анкеты</h2><p className="mt-1 text-xs text-gray-400">Показано {visible.length} из {responses.length}</p></div><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Поиск по email, сфере или задаче" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm sm:max-w-sm"/></div>{loading ? <p className="py-8 text-center text-sm text-gray-400">Загружаем…</p> : visible.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead><tr className="border-b border-gray-100 text-gray-400"><th className="px-3 py-3 font-medium">Пользователь</th><th className="px-3 py-3 font-medium">Кто / цель</th><th className="px-3 py-3 font-medium">Сфера</th><th className="px-3 py-3 font-medium">Нужные функции</th><th className="px-3 py-3 font-medium">Пожелания</th></tr></thead><tbody>{visible.map((item) => <tr key={item.user_id} className="border-b border-gray-50 align-top"><td className="px-3 py-3"><span className="font-medium text-slate-800">{item.email}</span><span className="mt-1 block text-[10px] text-gray-400">{new Date(item.updated_at).toLocaleDateString("ru-RU")}{item.skipped ? " · пропустил анкету" : ""}</span></td><td className="px-3 py-3 text-slate-700">{personaLabels[item.persona] || item.persona}<span className="mt-1 block text-gray-500">{purposeLabels[item.purpose] || item.purpose || "—"}</span><span className="mt-1 block text-gray-400">Собирает сценарии: {item.will_develop ? "да" : "нет / не указал"}</span></td><td className="px-3 py-3 text-slate-700">{item.industry || "—"}</td><td className="max-w-[220px] px-3 py-3 text-slate-700">{item.desired_features?.join(", ") || "—"}<span className="mt-1 block text-gray-500">{item.planned_use || ""}</span></td><td className="max-w-[220px] whitespace-pre-wrap px-3 py-3 text-slate-700">{item.notes || "—"}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-gray-400">Пока нет анкет. Они появятся после заполнения мини-опроса новыми пользователями.</p>}</div></>}
  </div>;
}

function Metric({ label, value }) { return <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-navy-950">{value}</p></div>; }
