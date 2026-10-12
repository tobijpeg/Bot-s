import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addEdge, Background, Controls, Handle, MiniMap, Position, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { useSitePreferences } from "../context/SitePreferencesContext.jsx";
import { createDefaultWorkflow, nodeCategories, nodeKinds, workflowPresets } from "../workflow.js";
import { getWorkflowClarificationQuestions, isWorkflowCreationRequest } from "../workflow-ai.js";
import { supabase, supabaseSetupError } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";

function WorkflowNode({ data, selected }) {
  const kind = nodeKinds[data.kind] || nodeKinds.message;
  return <div className={`w-52 overflow-hidden rounded-xl border bg-white shadow-md ${selected ? "border-accent-500 ring-2 ring-accent-500/20" : kind.color}`}>
    {data.kind !== "start" && <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400" />}
    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2"><span>{kind.icon}</span><span className="truncate text-xs font-semibold text-slate-800">{data.title || kind.title}</span></div>
    <div className="px-3 py-2 text-[11px] leading-4 text-slate-500">{data.text || data.keywords || kind.title}</div>
    {data.kind !== "fallback" && <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-accent-500" />}
  </div>;
}
const nodeTypes = { workflow: WorkflowNode };
const editDraftKey = (userId, botId) => `bots-kz-editor-draft-v1:${userId}:${botId}`;
const AI_BUILDER_COPY = {
  ru: {
    title: "ИИ-помощник", subtitle: "Строит и меняет схему конструктора",
    intro: "Хорошо, подготовлю сценарий под ваш бизнес. Перед построением уточню пару деталей — ответьте одним сообщением:",
    initialHint: "Опишите задачу бизнеса обычными словами. Для нового сценария сначала уточню пару деталей, затем построю шаги и тексты прямо на схеме.",
    placeholder: "Например: создай запись для студии массажа…", answerPlaceholder: "Ответьте на оба вопроса одним сообщением…",
    submit: "Применить к схеме", answerSubmit: "Отправить ответы и построить", skip: "Построить без уточнений", busy: "Изменяю схему…", working: "ИИ строит сценарий…",
    applied: "Изменения уже применены к схеме — проверьте её и нажмите «Сохранить сценарий».", error: "Не получилось изменить сценарий:",
  },
  kk: {
    title: "ИИ көмекші", subtitle: "Конструктор сызбасын құрады және өзгертеді",
    intro: "Бизнесіңізге сай сценарий дайындаймын. Құрастыру алдында екі сұрақты нақтылаймын — екеуіне бір хабарламада жауап беріңіз:",
    initialHint: "Бот бизнесіңізге қалай көмектесуі керегін қарапайым сөзбен жазыңыз. Жаңа сценарий жасамас бұрын екі сұрақ қойып, қадамдар мен мәтіндерді сызбаға қосамын.",
    placeholder: "Мысалы: массаж студиясына жазылу ботын жаса…", answerPlaceholder: "Екі сұраққа бір хабарламада жауап беріңіз…",
    submit: "Сызбаға қолдану", answerSubmit: "Жауап беріп, сценарий құру", skip: "Сұрақтарсыз құру", busy: "Сценарий өзгертілуде…", working: "ИИ сценарий құрып жатыр…",
    applied: "Өзгерістер сызбаға қосылды. Тексеріп, «Сценарийді сақтау» батырмасын басыңыз.", error: "Сценарийді өзгерту мүмкін болмады:",
  },
  en: {
    title: "AI assistant", subtitle: "Builds and updates the workflow",
    intro: "I’ll tailor the workflow to your business. Before building it, I need two details. Reply to both in one message:",
    initialHint: "Describe what your business needs in plain language. For a new workflow, I’ll ask two quick questions, then build its steps and copy on the canvas.",
    placeholder: "For example: create bookings for my massage studio…", answerPlaceholder: "Answer both questions in one message…",
    submit: "Apply to workflow", answerSubmit: "Send answers and build", skip: "Build without questions", busy: "Updating workflow…", working: "AI is building the workflow…",
    applied: "The changes are on the canvas. Review them, then select “Save workflow”.", error: "Could not update the workflow:",
  },
};
const cleanWorkflow = (nodes, edges) => ({
  nodes: nodes.map((node) => {
    const cleanNode = { ...node };
    ["selected", "dragging", "resizing", "measured", "positionAbsolute", "width", "height"].forEach((key) => delete cleanNode[key]);
    return cleanNode;
  }),
  edges: edges.map((edge) => {
    const cleanEdge = { ...edge };
    delete cleanEdge.selected;
    return cleanEdge;
  }),
});

export default function BotFlowEditor() {
  const navigate = useNavigate();
  const { botId: routeBotId } = useParams();
  const editing = Boolean(routeBotId);
  const context = useCreateBot();
  const { language: siteLanguage } = useSitePreferences();
  const aiCopy = AI_BUILDER_COPY[siteLanguage] || AI_BUILDER_COPY.ru;
  const { userId, botUsername, botName, category, templates, businessName, description, features, items, contacts, ownerTelegramId, greeting, workflow, setField, updateItem, addItem, removeItem, setContact } = context;
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiClarification, setAiClarification] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [blockCategory, setBlockCategory] = useState("Все блоки");
  const [blockSearch, setBlockSearch] = useState("");
  const [myScripts, setMyScripts] = useState([]);
  const [scriptName, setScriptName] = useState("");
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptMessage, setScriptMessage] = useState("");
  const [toolTab, setToolTab] = useState("blocks");
  const [inspectorTab, setInspectorTab] = useState("ai");
  const [draftReadyBotId, setDraftReadyBotId] = useState(editing ? "" : "new");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const initialServerConfig = useRef(null);
  const suppressDraftSave = useRef(false);
  const selectedNode = nodes.find((node) => node.id === selectedId);
  const currentConfig = useMemo(() => ({ businessName, template: templates[category]?.label, description, greeting, features, items, contacts, ownerTelegramId, workflow: cleanWorkflow(nodes, edges) }), [businessName, templates, category, description, greeting, features, items, contacts, ownerTelegramId, nodes, edges]);
  const kinds = useMemo(() => Object.entries(nodeKinds), []);
  const visibleKinds = kinds.filter(([kind, value]) => kind !== "start" && (blockCategory === "Все блоки" || nodeCategories[blockCategory]?.includes(kind)) && `${value.title} ${kind}`.toLowerCase().includes(blockSearch.trim().toLowerCase()));

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    suppressDraftSave.current = false;
    setDraftReadyBotId("");
    setDraftRestored(false);
    Promise.resolve().then(async () => {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      const response = await apiFetch(`/api/bots/${routeBotId}`, { headers: { Authorization: `Bearer ${authData.session?.access_token || ""}` } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Не удалось загрузить бота.");
      return result.bot;
    }).then((bot) => {
      if (!alive) return;
      const config = bot.config || {};
      const templateKey = Object.keys(templates).find((key) => templates[key].label === config.template) || (config.template === "Своя структура" ? "custom" : "shop");
      const template = templates[templateKey] || {};
      const serverConfig = { businessName: config.businessName || "", template: templates[templateKey]?.label, description: config.description || "", greeting: config.greeting || template.greeting || "Здравствуйте! Добро пожаловать. Выберите действие, чтобы продолжить.", features: config.features || template.features || [], items: config.items || [], contacts: config.contacts || { hours: "", address: "", phone: "", language: "Русский и казахский" }, ownerTelegramId: config.ownerTelegramId || "", workflow: config.workflow || createDefaultWorkflow() };
      let activeConfig = serverConfig;
      let hasRestoredDraft = false;
      try {
        const draft = JSON.parse(localStorage.getItem(editDraftKey(userId, bot.id)) || "null");
        const savedAt = Date.parse(draft?.savedAt || "") || 0;
        const serverUpdatedAt = Date.parse(bot.updated_at || bot.created_at || "") || 0;
        if (draft?.config && savedAt > serverUpdatedAt) { activeConfig = { ...serverConfig, ...draft.config }; hasRestoredDraft = true; }
      } catch { /* Ignore a damaged local draft and use the server copy. */ }
      const activeTemplateKey = Object.keys(templates).find((key) => templates[key].label === activeConfig.template) || templateKey;
      setField("botId", bot.id); setField("botUsername", bot.username); setField("botName", bot.botName); setField("verified", true); setField("status", bot.status);
      setField("category", activeTemplateKey); setField("businessName", activeConfig.businessName); setField("description", activeConfig.description);
      setField("features", activeConfig.features); setField("items", activeConfig.items);
      setField("contacts", activeConfig.contacts); setField("ownerTelegramId", activeConfig.ownerTelegramId);
      setField("greeting", activeConfig.greeting); setField("workflow", activeConfig.workflow);
      setNodes(activeConfig.workflow.nodes); setEdges(activeConfig.workflow.edges);
      initialServerConfig.current = serverConfig;
      setDraftRestored(hasRestoredDraft);
      setDraftReadyBotId(bot.id);
    }).catch((exception) => { if (alive) setError(exception.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [editing, routeBotId, setField, setNodes, setEdges, templates, userId]);

  useEffect(() => { setField("workflow", { nodes, edges }); }, [nodes, edges, setField]);

  useEffect(() => {
    if (!editing || !userId || !routeBotId || draftReadyBotId !== routeBotId || suppressDraftSave.current || !initialServerConfig.current) return undefined;
    const key = editDraftKey(userId, routeBotId);
    const serialized = JSON.stringify(currentConfig);
    if (serialized === JSON.stringify(initialServerConfig.current)) {
      localStorage.removeItem(key);
      setDraftSaved(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), config: currentConfig }));
        setDraftSaved(true);
      } catch { setDraftSaved(false); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [editing, userId, routeBotId, draftReadyBotId, currentConfig]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!supabase) return [];
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) return [];
      const { data, error: queryError } = await supabase.from("workflow_library").select("id,name,description,workflow,updated_at").order("updated_at", { ascending: false }).limit(50);
      if (queryError) throw queryError;
      return data || [];
    }).then((rows) => { if (active) setMyScripts(rows); }).catch((exception) => { if (active) setScriptMessage(`Не удалось загрузить личные сценарии: ${exception.message}`); });
    return () => { active = false; };
  }, []);

  const onConnect = useCallback((params) => {
    setEdges((current) => addEdge({ ...params, id: `edge-${crypto.randomUUID()}` }, current));
  }, [setEdges]);

  function addNode(kind) {
    const id = `node-${crypto.randomUUID()}`;
    const metadata = nodeKinds[kind];
    const node = { id, type: "workflow", position: { x: 180 + (nodes.length % 4) * 55, y: 120 + (nodes.length % 5) * 75 }, data: { kind, title: metadata.title, text: ["message", "fallback", "booking", "question", "condition", "delay", "notification", "link", "location"].includes(kind) ? "Настройте текст этого блока…" : "", buttonLabel: metadata.title, keywords: "", delaySeconds: kind === "delay" ? 5 : 0 } };
    setNodes((current) => [...current, node]); setSelectedId(id);
  }

  function applyPreset(key) {
    const preset = workflowPresets[key];
    if (!preset) return;
    const nextWorkflow = preset.build();
    setNodes(nextWorkflow.nodes); setEdges(nextWorkflow.edges); setSelectedId(null);
    setAiMessages((current) => [...current, { role: "assistant", text: `Добавлен сценарий «${preset.label}». Настройте текст блоков, реальные контакты и сохраните схему.` }]);
  }

  async function saveScript() {
    const name = scriptName.trim();
    if (!name || scriptBusy) return;
    setScriptBusy(true); setScriptMessage("");
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) throw new Error("Войдите в аккаунт заново.");
      const { data, error: saveError } = await supabase.from("workflow_library").insert({ owner_id: authData.session.user.id, name, description: "Личный сценарий бизнеса", workflow: { nodes, edges } }).select("id,name,description,workflow,updated_at").single();
      if (saveError) throw saveError;
      setMyScripts((current) => [data, ...current].slice(0, 50)); setScriptName(""); setScriptMessage(`Сценарий «${name}» сохранён в вашей библиотеке.`);
    } catch (exception) { setScriptMessage(`Не удалось сохранить: ${exception.message}`); }
    finally { setScriptBusy(false); }
  }

  function applySavedScript(script, mode = "replace") {
    const sourceNodes = script.workflow?.nodes || [];
    const sourceEdges = script.workflow?.edges || [];
    if (!sourceNodes.length) { setScriptMessage("В этом сценарии пока нет шагов."); return; }
    if (mode === "replace") {
      setNodes(sourceNodes); setEdges(sourceEdges); setSelectedId(null);
      setScriptMessage(`Открыт ваш сценарий «${script.name}». Он заменил текущую структуру; нажмите «Сохранить сценарий», чтобы применить её к боту.`);
      return;
    }
    const menu = nodes.find((node) => node.id === selectedId && node.data.kind === "menu") || nodes.find((node) => node.data.kind === "menu");
    if (!menu) { setScriptMessage("Чтобы вставить личный процесс, сначала добавьте блок меню в текущий сценарий."); return; }
    const included = sourceNodes.filter((node) => !["start", "fallback"].includes(node.data?.kind));
    const includedIds = new Set(included.map((node) => node.id));
    const start = sourceNodes.find((node) => node.data?.kind === "start");
    const entries = start ? sourceEdges.filter((edge) => edge.source === start.id && includedIds.has(edge.target)).map((edge) => edge.target) : included.filter((node) => !sourceEdges.some((edge) => edge.target === node.id && includedIds.has(edge.source))).map((node) => node.id);
    if (!included.length || !entries.length) { setScriptMessage("В личном сценарии не нашёл начало процесса для вставки. Откройте его целиком или сохраните с блоком «Начало»."); return; }
    const prefix = `lib-${crypto.randomUUID()}`;
    const idMap = new Map(included.map((node, index) => [node.id, `${prefix}-${index}`]));
    const maxX = Math.max(0, ...nodes.map((node) => node.position?.x || 0));
    const importedNodes = included.map((node, index) => ({ ...node, id: idMap.get(node.id), position: { x: maxX + 300 + ((index % 3) * 230), y: 100 + (Math.floor(index / 3) * 170) }, data: { ...node.data } }));
    const importedEdges = sourceEdges.filter((edge) => includedIds.has(edge.source) && includedIds.has(edge.target)).map((edge) => ({ ...edge, id: `${prefix}-${edge.id}`, source: idMap.get(edge.source), target: idMap.get(edge.target) }));
    const connectors = entries.map((entryId, index) => ({ id: `${prefix}-entry-${index}`, source: menu.id, target: idMap.get(entryId), label: importedNodes.find((node) => node.id === idMap.get(entryId))?.data.buttonLabel || importedNodes.find((node) => node.id === idMap.get(entryId))?.data.title || script.name }));
    setNodes((current) => [...current, ...importedNodes]); setEdges((current) => [...current, ...importedEdges, ...connectors]);
    setScriptMessage(`Процесс «${script.name}» добавлен к меню. Проверьте переходы и сохраните сценарий.`);
  }

  async function deleteScript(script) {
    if (!supabase) return;
    setScriptBusy(true); setScriptMessage("");
    const { error: deleteError } = await supabase.from("workflow_library").delete().eq("id", script.id);
    if (deleteError) setScriptMessage(`Не удалось удалить сценарий: ${deleteError.message}`);
    else { setMyScripts((current) => current.filter((item) => item.id !== script.id)); setScriptMessage(`Сценарий «${script.name}» удалён из библиотеки.`); }
    setScriptBusy(false);
  }

  function updateSelected(field, value) {
    setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, [field]: value } } : node));
  }

  async function requestAIScenario(question) {
    setAiBusy(true); setError("");
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) throw new Error("Сессия Supabase истекла. Войдите заново.");
      const response = await apiFetch("/api/ai/workflow", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session.access_token}` }, body: JSON.stringify({ question, workflow: { nodes, edges }, context: { description, businessName, template: templates[category]?.label, language: contacts?.language || "", interfaceLanguage: siteLanguage, ownerTelegramId } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ИИ не смог изменить сценарий.");
      setNodes(result.workflow.nodes); setEdges(result.workflow.edges); setSelectedId(null);
      setAiMessages((current) => [...current, { role: "assistant", text: `${result.answer} ${aiCopy.applied} ${siteLanguage === "en" ? "Monthly limit" : siteLanguage === "kk" ? "Айлық лимит" : "Лимит за месяц"}: ${result.used}/${result.limit}.` }]);
    } catch (exception) {
      setAiMessages((current) => [...current, { role: "assistant", text: `${aiCopy.error} ${exception.message}` }]);
    } finally { setAiBusy(false); }
  }

  async function askAI(event) {
    event.preventDefault();
    const input = aiPrompt.trim();
    if (!input || aiBusy) return;
    setAiPrompt("");
    setAiMessages((current) => [...current, { role: "user", text: input }]);

    if (aiClarification) {
      const { original } = aiClarification;
      setAiClarification(null);
      await requestAIScenario(`${original.slice(0, 800)}\nУточнения владельца: ${input.slice(0, 900)}\nВыполни исходную просьбу с учётом уточнений; заполни тексты блоков и подписи кнопок под бизнес.`);
      return;
    }

    if (isWorkflowCreationRequest(input)) {
      const questions = getWorkflowClarificationQuestions(input, { businessName, description, template: templates[category]?.label, locale: siteLanguage });
      setAiClarification({ original: input, questions });
      setAiMessages((current) => [...current, { role: "assistant", text: `${aiCopy.intro}\n\n1. ${questions[0]}\n\n2. ${questions[1]}` }]);
      return;
    }

    await requestAIScenario(input);
  }

  function skipAIClarification() {
    if (!aiClarification || aiBusy) return;
    const { original } = aiClarification;
    setAiClarification(null);
    setAiMessages((current) => [...current, { role: "assistant", text: siteLanguage === "en" ? "I’ll build from your initial description. If a business detail is missing, the bot will ask the customer for it." : siteLanguage === "kk" ? "Алғашқы сипаттамаңыз бойынша құрамын. Мәлімет жетіспесе, бот клиенттен оны сұрайды." : "Построю по вашему первому описанию. Если данных не хватает, бот попросит клиента сообщить их в диалоге." }]);
    void requestAIScenario(original);
  }

  async function save() {
    setSaving(true); setError(""); setSaved("");
    const config = currentConfig;
    if (!editing) {
      setField("workflow", config.workflow); setSaving(false); navigate("/create/setup"); return;
    }
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      const response = await apiFetch(`/api/bots/${routeBotId}/config`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session?.access_token || ""}` }, body: JSON.stringify(config) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить настройки.");
      suppressDraftSave.current = true;
      initialServerConfig.current = config;
      if (userId) localStorage.removeItem(editDraftKey(userId, routeBotId));
      setDraftSaved(false); setDraftRestored(false);
      setField("status", result.bot.status);
      setSaved(result.bot.status === "Работает на сервере платформы"
        ? "Сценарий сохранён и применён к работающему боту в Telegram."
        : "Сценарий сохранён. Бот остановлен: откройте «Мои боты» и нажмите «Запустить», чтобы изменения заработали в Telegram.");
    } catch (exception) { setError(exception.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-2xl bg-white p-8 text-sm text-gray-500">Загружаю настройки бота…</div>;

  return <div className="max-w-[1500px]">
    <div className="flex h-auto min-h-[calc(100dvh-120px)] flex-col gap-3 xl:h-[calc(100dvh-105px)] xl:min-h-[540px]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">{editing ? `Редактор · @${botUsername || "bot"}` : "Визуальный конструктор"}</p>{editing && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{botName || "Telegram-бот"}</span>}</div><h1 className="mt-0.5 font-display text-xl font-bold text-navy-950">{editing ? "Редактирование бота" : "Собери сценарий из блоков"}</h1></div>
        <div className="flex items-center gap-2"><span className="hidden text-[11px] text-gray-400 sm:inline">{draftSaved ? "Черновик сохранён в этом браузере" : saved || "Изменения сохраняются в черновик"}</span><button onClick={() => navigate(editing ? "/bots" : "/create/structure")} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50">Назад</button><button onClick={save} disabled={saving} className="rounded-xl bg-navy-950 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-900 disabled:opacity-50">{saving ? "Сохраняю…" : editing ? "Сохранить" : "Продолжить →"}</button></div>
      </header>

      {draftRestored && <p role="status" className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">Восстановлен несохранённый черновик этого бота. Проверьте изменения и нажмите «Сохранить».</p>}

      <section className="shrink-0 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-sm shadow-slate-900/5" data-tour-id="scenario-tools">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2">
          {[ ["blocks", "▦ Блоки"], ["examples", "✦ Примеры"], ["scripts", "↗ Мои процессы"] ].map(([key, label]) => <button key={key} onClick={() => setToolTab(key)} className={`shrink-0 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition ${toolTab === key ? "bg-violet-50 text-violet-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{label}</button>)}
          <p className="ml-auto hidden pr-3 text-[10px] text-slate-400 xl:block">Перетащите блок на схему или нажмите, чтобы добавить</p>
        </div>
        {toolTab === "blocks" && <div className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2"><input aria-label="Поиск блоков" value={blockSearch} onChange={(event) => setBlockSearch(event.target.value)} placeholder="Найти блок…" className="w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-violet-300 sm:w-48"/><div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">{["Все блоки", ...Object.keys(nodeCategories)].map((name) => <button key={name} onClick={() => setBlockCategory(name)} className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-medium ${blockCategory === name ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-violet-50"}`}>{name}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">{visibleKinds.map(([kind, value]) => <button key={kind} onClick={() => addNode(kind)} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-900"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-sm shadow-sm">{value.icon}</span><span className="truncate">{value.title}</span><span className="ml-auto text-violet-500">＋</span></button>)}{visibleKinds.length === 0 && <p className="col-span-full px-2 py-3 text-xs text-gray-400">Нет блоков по запросу.</p>}</div>
        </div>}
        {toolTab === "examples" && <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-4">{Object.entries(workflowPresets).map(([key, preset]) => <button key={key} onClick={() => applyPreset(key)} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50"><span className="block truncate text-xs font-semibold text-slate-800">{preset.label}</span><span className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-500">{preset.description}</span></button>)}</div>}
        {toolTab === "scripts" && <div className="space-y-2 p-3" data-tour-id="personal-scripts">
          <form onSubmit={(event) => { event.preventDefault(); saveScript(); }} className="flex gap-2"><input value={scriptName} onChange={(event) => setScriptName(event.target.value)} maxLength={80} placeholder="Название вашего процесса…" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-xs"/><button disabled={!scriptName.trim() || scriptBusy} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{scriptBusy ? "Сохраняю…" : "Сохранить схему"}</button></form>
          {scriptMessage && <p role="status" className="text-[11px] text-slate-600">{scriptMessage}</p>}
          <div className="flex max-h-[78px] gap-2 overflow-x-auto">{myScripts.length ? myScripts.map((script) => <article key={script.id} className="min-w-56 rounded-xl border border-slate-100 bg-slate-50 p-2.5"><p className="truncate text-[11px] font-semibold text-slate-800">{script.name}</p><p className="mt-1 text-[10px] text-gray-500">{script.workflow?.nodes?.length || 0} блоков · {new Date(script.updated_at).toLocaleDateString("ru-RU")}</p><div className="mt-2 flex gap-1.5"><button onClick={() => applySavedScript(script, "insert")} className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-semibold text-white">Вставить</button><button onClick={() => applySavedScript(script, "replace")} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold">Открыть</button><button onClick={() => deleteScript(script)} className="px-1 text-[10px] text-red-600">Удалить</button></div></article>) : <p className="py-2 text-xs text-gray-400">Сохраните схему, чтобы использовать её в других ботах.</p>}</div>
        </div>}
      </section>

      <div className="grid min-h-[680px] flex-1 grid-cols-1 gap-3 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_360px]" data-tour-id="scenario-editor">
        <div className="relative min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 xl:min-h-0"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={({ nodes: selected }) => { setSelectedId(selected[0]?.id || null); if (selected[0]) setInspectorTab("node"); }} fitView fitViewOptions={{ padding: 0.2 }} deleteKeyCode={["Backspace", "Delete"]}><Background color="#ddd6fe" gap={22} /><MiniMap pannable zoomable /><Controls /></ReactFlow><span className="pointer-events-none absolute left-3 top-3 rounded-lg border border-slate-100 bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 shadow-sm">Сценарий · {nodes.length} блоков</span></div>
        <aside className="flex min-h-[430px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 xl:min-h-0" data-tour-id="ai-builder-panel">
          <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 bg-slate-50/70 p-2">{[["ai", "✦ ИИ"], ["node", "▣ Свойства"], ["business", "⌂ Бизнес"]].map(([key, label]) => <button key={key} onClick={() => setInspectorTab(key)} className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${inspectorTab === key ? "bg-white text-violet-800 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{label}</button>)}</div>
          {inspectorTab === "ai" && <section className="flex min-h-0 flex-1 flex-col p-3" data-tour-id="ai-builder-panel-inner">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">✦</span><div><h2 className="text-sm font-bold text-navy-950">{aiCopy.title}</h2><p className="text-[10px] text-gray-500">{aiCopy.subtitle}</p></div></div>
            <div aria-live="polite" className="mt-3 min-h-24 flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2.5">
              {aiMessages.length === 0 && <p className="rounded-lg border border-violet-100 bg-white p-3 text-xs leading-5 text-gray-600">{aiCopy.initialHint}</p>}
              {aiMessages.map((message, index) => <p key={index} className={`whitespace-pre-line rounded-xl p-2.5 text-xs leading-5 ${message.role === "user" ? "ml-4 bg-violet-100 text-violet-950" : "mr-2 border border-slate-100 bg-white text-gray-700"}`}>{message.text}</p>)}
              {aiBusy && <p className="px-2 text-xs text-gray-500">{aiCopy.working}</p>}
            </div>
            <form onSubmit={askAI} className="mt-3 shrink-0 space-y-2"><textarea aria-label={aiClarification ? aiCopy.answerSubmit : aiCopy.title} rows={3} maxLength={aiClarification ? 900 : 2000} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder={aiClarification ? aiCopy.answerPlaceholder : aiCopy.placeholder} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/><button type="submit" disabled={aiBusy || !aiPrompt.trim()} className="w-full rounded-xl bg-violet-700 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50">{aiBusy ? aiCopy.busy : aiClarification ? aiCopy.answerSubmit : aiCopy.submit}</button>{aiClarification && <button type="button" onClick={skipAIClarification} disabled={aiBusy} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">{aiCopy.skip}</button>}</form>
          </section>}
          {inspectorTab === "node" && <section className="min-h-0 flex-1 overflow-y-auto p-4">
            {selectedNode ? <><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Блок сценария</p><h2 className="mt-1 text-sm font-bold text-navy-950">{nodeKinds[selectedNode.data.kind]?.icon} {nodeKinds[selectedNode.data.kind]?.title}</h2></div><button onClick={() => { setNodes((current) => current.filter((node) => node.id !== selectedId)); setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(null); }} disabled={selectedNode.data.kind === "start"} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30">Удалить</button></div>
              <Field label="Название блока" value={selectedNode.data.title || ""} onChange={(value) => updateSelected("title", value)} />
              {["message", "fallback", "booking", "question", "condition", "delay", "notification", "link", "location", "document", "handoff", "payment", "feedback", "subscribe"].includes(selectedNode.data.kind) && <Field label="Текст для клиента" multiline value={selectedNode.data.text || ""} onChange={(value) => updateSelected("text", value)} />}
              {selectedNode.data.kind === "delay" && <Field label="Пауза в секундах (0–300)" type="number" min={0} max={300} value={selectedNode.data.delaySeconds ?? 5} onChange={(value) => updateSelected("delaySeconds", Math.max(0, Math.min(300, Number(value) || 0)))} />}
              {selectedNode.data.kind === "condition" && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-gray-500">Этот блок показывает кнопки по исходящим связям. Подписи задаются на линиях.</p>}
              {selectedNode.data.kind === "menu" && <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-900">Каждая связь из этого меню станет отдельной кнопкой в Telegram.</p>}
              {selectedNode.data.kind === "document" && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Файлы появятся во «Входящих». Дополнительное Telegram-уведомление можно включить в настройках бизнеса.</p>}
              {["catalog", "contacts"].includes(selectedNode.data.kind) && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-gray-500">Используются позиции и контакты из вкладки «Бизнес».</p>}
              {selectedNode.data.kind === "keyword" && <Field label="Ключевые слова через запятую" value={selectedNode.data.keywords || ""} onChange={(value) => updateSelected("keywords", value)} />}
              {["link", "payment"].includes(selectedNode.data.kind) && <Field label="HTTPS-ссылка" value={selectedNode.data.url || ""} onChange={(value) => updateSelected("url", value)} />}
              {selectedNode.data.kind !== "start" && <Field label="Подпись кнопки" value={selectedNode.data.buttonLabel || ""} onChange={(value) => updateSelected("buttonLabel", value)} />}
            </> : <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl text-violet-700">▣</span><h2 className="mt-3 text-sm font-bold text-navy-950">Выберите блок</h2><p className="mt-1 max-w-56 text-xs leading-5 text-gray-500">Нажмите на блок на схеме, чтобы изменить текст, подпись и настройки.</p></div>}
          </section>}
          {inspectorTab === "business" && <section className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Профиль компании</p><h2 className="mt-1 text-sm font-bold text-navy-950">Данные бизнеса</h2><Field label="Название" value={businessName} onChange={(value) => setField("businessName", value)} /><Field label="Приветствие /start" multiline value={greeting} onChange={(value) => setField("greeting", value)} /><Field label="Адрес" value={contacts.address} onChange={(value) => setContact("address", value)} /><Field label="График" value={contacts.hours} onChange={(value) => setContact("hours", value)} /><Field label="Телефон" value={contacts.phone} onChange={(value) => setContact("phone", value)} /><Field label="Telegram ID уведомлений (необязательно)" value={ownerTelegramId} onChange={(value) => setField("ownerTelegramId", value.replace(/[^0-9-]/g, "").slice(0, 20))} /><p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[10px] leading-4 text-gray-500">Все обращения и документы доступны в разделе «Входящие».</p></div>
            <div className="border-t border-slate-100 pt-3"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-navy-950">Товары и услуги · ₸</h2><button onClick={addItem} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-800 hover:bg-violet-100">＋ Добавить</button></div><div className="mt-2 space-y-2">{items.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_72px_24px] items-center gap-1.5"><input aria-label="Название товара" value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} className="min-w-0 rounded-lg border border-gray-200 bg-slate-50 px-2 py-2 text-[11px]"/><input aria-label="Цена в тенге" type="number" min="0" value={item.price} onChange={(event) => updateItem(index, "price", Number(event.target.value))} className="w-full rounded-lg border border-gray-200 bg-slate-50 px-2 py-2 text-[11px]"/><button aria-label="Удалить позицию" onClick={() => removeItem(index)} className="rounded-md py-1 text-lg text-red-500 hover:bg-red-50">×</button></div>)}</div><p className="mt-2 text-[10px] leading-4 text-amber-700">Проверьте примерные цены шаблона перед запуском.</p></div>
          </section>}
        </aside>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-[10px] text-slate-500"><span>Опишите правки ИИ или соедините блоки на схеме.</span><span>{editing ? "Сохраните, чтобы применить изменения в Telegram." : "Черновик конструктора сохраняется в этом браузере."} ИИ не отвечает клиентам.</span></div>
      {(error || saved) && <p role={error ? "alert" : "status"} className={`shrink-0 rounded-lg p-2.5 text-xs ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{error || saved}</p>}
    </div>
    <p className="sr-only">Основа: {category === "custom" ? "пользовательская структура" : templates[category]?.label}; подключённый бот: {botName}</p>
  </div>;
}

function Field({ label, value, onChange, multiline = false, type = "text", min, max }) {
  return <label className="mt-3 block"><span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>{multiline ? <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-accent-500" /> : <input type={type} min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-accent-500" />}</label>;
}
