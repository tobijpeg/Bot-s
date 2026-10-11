import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateBotProgress from "../components/CreateBotProgress.jsx";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { supabase, supabaseSetupError } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";

const prompts = ["Какой у вас город или район?", "Кто ваши клиенты и что чаще всего спрашивают?", "Как оформить заказ или записаться?", "Какие условия оплаты и доставки?" ];

export default function CreateBotDescribe() {
  const navigate = useNavigate();
  const { category, description, setField, templates, chooseTemplate, chooseCustom, botUsername, verified, setWorkflowPlan } = useCreateBot();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);

  async function generatePlan() {
    setLoading(true); setError(""); setPlan(null);
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      const response = await apiFetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session?.access_token || ""}` }, body: JSON.stringify({ description, category: templates[category]?.label }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не получилось собрать черновик. Попробуйте ещё раз.");
      setPlan(data); setWorkflowPlan(data);
    } catch (exception) { setError(exception.message); }
    finally { setLoading(false); }
  }

  async function askAssistant() {
    if (!question.trim()) return;
    setLoading(true); setError(""); setAnswer("");
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      const response = await apiFetch("/api/ai/assist", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session?.access_token || ""}` }, body: JSON.stringify({ question, context: { description, template: templates[category]?.label } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось получить подсказку. Попробуйте ещё раз.");
      setAnswer(`${data.answer || "Не удалось сформировать ответ."}\n\nПомощник: ${data.used} из ${data.limit} запросов в этом месяце`);
    } catch (exception) { setError(exception.message); }
    finally { setLoading(false); }
  }

  return <div>
    <CreateBotProgress />
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_330px]">
      <section className="rounded-2xl bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4" data-tour-id="business-description"><p className="text-sm font-semibold text-navy-950">Расскажите своими словами — сценарий может быть любым</p><ol className="mt-2 grid gap-2 text-xs leading-5 text-gray-600 sm:grid-cols-2"><li><b>1.</b> Опишите процессы компании и реальные правила. Шаблон можно не выбирать.</li><li><b>2.</b> Попросите ИИ составить персональный черновик — идеи и блоки проверяются вами.</li><li><b>3.</b> На визуальном полотне добавляйте, соединяйте и редактируйте шаги.</li><li><b>4.</b> Заполните контакты и ссылки, проверьте сценарий и запустите бота.</li></ol><p className="mt-2 text-[11px] text-gray-500">Готовые примеры необязательны. Можно начать с пустой структуры и собрать свою.</p></div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">✓ @{botUsername || "ваш бот"} {verified && "подключён"}</div>
        <h1 className="font-display text-2xl font-bold text-navy-950">Опишите, как работает ваш бизнес</h1>
        <p className="mt-2 text-sm text-gray-500">Шаблоны — необязательная основа. Можно сразу описать индивидуальный процесс компании.</p>
        <div className="mt-6"><p className="mb-2 text-xs font-medium text-gray-500">Готовые примеры — по желанию</p><div className="grid gap-3 sm:grid-cols-3">{Object.entries(templates).map(([key, template]) => <button key={key} onClick={() => chooseTemplate(key)} className={`rounded-xl border p-4 text-left transition ${category === key ? "border-accent-500 bg-accent-500/5 ring-2 ring-accent-500/10" : "border-gray-200 hover:border-gray-300"}`}><span className="text-2xl">{template.emoji}</span><span className="mt-3 block text-sm font-semibold text-navy-950">{template.label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{template.features.slice(0, 3).join(" · ")}</span></button>)}</div><button onClick={chooseCustom} className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${category === "custom" ? "border-accent-500 bg-accent-500/5 text-accent-700" : "border-gray-200 text-gray-600"}`}>{category === "custom" ? "✓ Выбрана своя структура · без шаблона" : "＋ Создать свою структуру без шаблона"}</button></div>
        <label className="mt-7 block"><span className="text-sm font-semibold text-navy-950">Расскажите о своём бизнесе</span><span className="mt-1 block text-xs text-gray-400">Добавьте название, город, особенности и то, как клиенты совершают заказ.</span><textarea value={description} onChange={(event) => setField("description", event.target.value)} rows={6} placeholder="Например: кофейня в Астане, рядом с Байтереком…" className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-navy-950 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/10" /></label>
        <div className="mt-5 flex justify-between"><button onClick={() => navigate("/create/token")} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-gray-50">Назад</button><button onClick={() => navigate(plan || category === "custom" ? "/create/flow" : "/create/structure")} disabled={!description.trim()} className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-40">{plan || category === "custom" ? "Открыть визуальный редактор →" : "Настроить возможности →"}</button></div>
      </section>
      <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">✦</span><div><p className="text-sm font-semibold text-navy-950">ИИ-помощник конструктора</p><p className="text-xs text-gray-400">Работает на сервере · до 20 запросов в месяц</p></div></div><label className="mt-5 block"><span className="mb-1.5 block text-xs font-medium text-gray-500">Опишите бизнес, путь клиента и правила</span><textarea value={description} onChange={(event) => setField("description", event.target.value)} rows={8} placeholder="Например: мы ремонтируем промышленное оборудование. Клиент указывает модель станка, срочность и прикладывает описание неисправности. Затем выбирает выезд или доставку оборудования. Бот собирает сведения, сохраняет заявку во входящих и показывает номер диспетчера." className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-5 outline-none focus:border-accent-500" /></label><button onClick={generatePlan} disabled={!description.trim() || loading} className="mt-3 w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-40">{loading ? "Составляю план для вашего бизнеса…" : "✦ Подготовить план бота"}</button>{plan && <div className="mt-4 rounded-xl bg-violet-50 p-4"><p className="text-xs font-semibold text-navy-950">Ваш черновик · {plan.nodes?.length || 0} шагов</p><p className="mt-1 text-xs leading-5 text-gray-700">{plan.greeting}</p><p className="mt-2 text-xs text-gray-600">Это предложение для вашей компании. Проверьте реальные данные, прежде чем запускать бота.</p><ul className="mt-2 list-inside list-disc text-xs leading-5 text-gray-600">{plan.features?.slice(0, 4).map((feature, index) => <li key={index}>{feature}</li>)}</ul><button onClick={() => { const nodes = plan.nodes.map((node) => ({ id: node.id, type: "workflow", position: { x: node.x, y: node.y }, data: { kind: node.kind, title: node.title, text: node.text, buttonLabel: node.buttonLabel, keywords: node.keywords } })); const edges = plan.edges.map((edge, index) => ({ ...edge, id: `ai-${index}` })); setField("workflow", { nodes, edges }); setWorkflowPlan(plan); setAnswer("Готово. Откройте сценарий, проверьте шаги и при необходимости поправьте их перед запуском."); }} className="mt-3 w-full rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-violet-800">Использовать этот план →</button></div>}<p className="mt-4 text-xs font-medium text-gray-500">Нужна помощь? Спросите своими словами</p><div className="mt-2 flex flex-wrap gap-2">{prompts.map((item) => <button key={item} onClick={() => { setQuestion(item); setAnswer(""); }} className="rounded-full bg-gray-50 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-accent-500/10 hover:text-accent-600">{item}</button>)}</div><textarea rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Например: как лучше собрать заявку на запись?" className="mt-3 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-5 outline-none focus:border-accent-500" /><button onClick={askAssistant} disabled={!question.trim() || loading} className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-semibold text-navy-950 hover:bg-gray-50 disabled:opacity-40">Получить подсказку</button>{error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">{error}</p>}{answer && <p className="mt-3 whitespace-pre-line rounded-lg bg-violet-50 p-3 text-xs leading-5 text-navy-950">{answer}</p>}<div className="mt-4 border-t border-gray-100 pt-4"><p className="text-xs leading-5 text-gray-400">Помощник помогает вам создавать сценарий. Клиентские сообщения идут по правилам и шагам, которые вы настроили.</p></div></aside>
    </div>
  </div>;
}
