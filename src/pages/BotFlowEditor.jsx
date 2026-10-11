import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addEdge, Background, Controls, Handle, MiniMap, Position, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { createDefaultWorkflow, nodeCategories, nodeKinds, workflowPresets } from "../workflow.js";
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

export default function BotFlowEditor() {
  const navigate = useNavigate();
  const { botId: routeBotId } = useParams();
  const editing = Boolean(routeBotId);
  const context = useCreateBot();
  const { botUsername, botName, category, templates, businessName, description, features, items, contacts, ownerTelegramId, greeting, workflow, setField, updateItem, addItem, removeItem, setContact } = context;
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [blockCategory, setBlockCategory] = useState("Все блоки");
  const [blockSearch, setBlockSearch] = useState("");
  const [myScripts, setMyScripts] = useState([]);
  const [scriptName, setScriptName] = useState("");
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptMessage, setScriptMessage] = useState("");
  const selectedNode = nodes.find((node) => node.id === selectedId);
  const kinds = useMemo(() => Object.entries(nodeKinds), []);
  const visibleKinds = kinds.filter(([kind, value]) => kind !== "start" && (blockCategory === "Все блоки" || nodeCategories[blockCategory]?.includes(kind)) && `${value.title} ${kind}`.toLowerCase().includes(blockSearch.trim().toLowerCase()));

  useEffect(() => {
    if (!editing) return;
    let alive = true;
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
      const nextWorkflow = config.workflow || createDefaultWorkflow();
      setField("botId", bot.id); setField("botUsername", bot.username); setField("botName", bot.botName); setField("verified", true); setField("status", bot.status);
      setField("category", templateKey); setField("businessName", config.businessName || ""); setField("description", config.description || "");
      setField("features", config.features || template.features || []); setField("items", config.items || []);
      setField("contacts", config.contacts || { hours: "", address: "", phone: "", language: "Русский и казахский" });
      setField("ownerTelegramId", config.ownerTelegramId || "");
      setField("greeting", config.greeting || template.greeting || "Здравствуйте! Добро пожаловать. Выберите действие, чтобы продолжить."); setField("workflow", nextWorkflow);
      setNodes(nextWorkflow.nodes); setEdges(nextWorkflow.edges);
    }).catch((exception) => { if (alive) setError(exception.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [editing, routeBotId, setField, setNodes, setEdges, templates]);

  useEffect(() => { setField("workflow", { nodes, edges }); }, [nodes, edges, setField]);

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

  async function askAI(event) {
    event.preventDefault();
    const question = aiPrompt.trim();
    if (!question || aiBusy) return;
    setAiPrompt(""); setAiBusy(true); setError("");
    setAiMessages((current) => [...current, { role: "user", text: question }]);
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) throw new Error("Сессия Supabase истекла. Войдите заново.");
      const response = await apiFetch("/api/ai/workflow", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session.access_token}` }, body: JSON.stringify({ question, workflow: { nodes, edges }, context: { description, businessName, template: templates[category]?.label, ownerTelegramId } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ИИ не смог изменить сценарий.");
      setNodes(result.workflow.nodes); setEdges(result.workflow.edges); setSelectedId(null);
      setAiMessages((current) => [...current, { role: "assistant", text: `${result.answer} Изменения уже применены к схеме — проверь её и нажми «Сохранить сценарий». Лимит: ${result.used}/${result.limit}.` }]);
    } catch (exception) {
      setAiMessages((current) => [...current, { role: "assistant", text: `Не получилось изменить сценарий: ${exception.message}` }]);
    } finally { setAiBusy(false); }
  }

  async function save() {
    setSaving(true); setError(""); setSaved("");
      const config = { businessName, template: templates[category]?.label, description, greeting, features, items, contacts, ownerTelegramId, workflow: { nodes, edges } };
    if (!editing) {
      setField("workflow", config.workflow); setSaving(false); navigate("/create/setup"); return;
    }
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const { data: authData } = await supabase.auth.getSession();
      const response = await apiFetch(`/api/bots/${routeBotId}/config`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session?.access_token || ""}` }, body: JSON.stringify(config) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить настройки.");
      setField("status", result.bot.status);
      setSaved(result.bot.status === "Работает на сервере платформы"
        ? "Сценарий сохранён и применён к работающему боту в Telegram."
        : "Сценарий сохранён. Бот остановлен: откройте «Мои боты» и нажмите «Запустить», чтобы изменения заработали в Telegram.");
    } catch (exception) { setError(exception.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-2xl bg-white p-8 text-sm text-gray-500">Загружаю настройки бота…</div>;

  return <div className="max-w-[1500px]">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{editing ? `Редактор · @${botUsername || "bot"}` : "Визуальный конструктор"}</p><h1 className="mt-1 font-display text-2xl font-bold text-navy-950">{editing ? "Редактирование бота" : "Собери сценарий из блоков"}</h1><p className="mt-1 text-sm text-gray-500">Соедини блоки линиями. ИИ помогает только на этапе создания — бот отвечает клиентам по этим правилам.</p></div>
      <div className="flex gap-2"><button onClick={() => navigate(editing ? "/bots" : "/create/structure")} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Назад</button><button onClick={save} disabled={saving} className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Сохраняю…" : editing ? "Сохранить изменения" : "Сохранить сценарий →"}</button></div>
    </div>
    <section className="mb-3 space-y-3 rounded-xl border border-gray-100 bg-white p-3">
      <div><h2 className="text-sm font-bold text-navy-950">Готовые примеры · необязательно</h2><p className="mt-1 text-xs text-gray-500">Можно выбрать пример или оставить свою структуру «{category === "custom" ? "Без шаблона" : templates[category]?.label || "Своя структура"}». Любой пример заменит текущую схему.</p></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(workflowPresets).map(([key, preset]) => <button key={key} onClick={() => applyPreset(key)} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-left hover:border-violet-200 hover:bg-violet-50"><span className="block text-xs font-semibold text-slate-800">{preset.label}</span><span className="mt-1 block text-[11px] leading-4 text-gray-500">{preset.description}</span></button>)}</div>
    </section>
    <section className="mb-3 space-y-3 rounded-xl border border-violet-100 bg-white p-3" data-tour-id="personal-scripts">
      <div><h2 className="text-sm font-bold text-navy-950">Мои сценарии и процессы</h2><p className="mt-1 text-xs text-gray-500">Сохраните свою последовательность шагов и используйте её в других ботах. Это безопасные блоки конструктора, не произвольный программный код.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); saveScript(); }} className="flex gap-2"><input value={scriptName} onChange={(event) => setScriptName(event.target.value)} maxLength={80} placeholder="Например: приём заявки на ремонт" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs"/><button disabled={!scriptName.trim() || scriptBusy} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{scriptBusy ? "Сохраняю…" : "Сохранить текущий сценарий"}</button></form>
      {scriptMessage && <p role="status" className="text-xs text-slate-600">{scriptMessage}</p>}
      {myScripts.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{myScripts.map((script) => <article key={script.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3"><p className="truncate text-xs font-semibold text-slate-800">{script.name}</p><p className="mt-1 text-[11px] text-gray-500">{script.workflow?.nodes?.length || 0} шагов · обновлён {new Date(script.updated_at).toLocaleDateString("ru-RU")}</p><div className="mt-2 flex flex-wrap gap-2"><button onClick={() => applySavedScript(script, "insert")} className="rounded-md bg-violet-700 px-2.5 py-1.5 text-[11px] font-semibold text-white">Вставить процесс</button><button onClick={() => applySavedScript(script, "replace")} className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">Открыть целиком</button><button onClick={() => deleteScript(script)} className="ml-auto text-[11px] text-red-600">Удалить</button></div></article>)}</div>}
    </section>
    <section className="mb-3 space-y-3 rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-navy-950">Библиотека блоков</h2><p className="mt-1 text-xs text-gray-500">Выберите действие и соедините его с другими блоками.</p></div><input aria-label="Поиск блоков" value={blockSearch} onChange={(event) => setBlockSearch(event.target.value)} placeholder="Найти блок…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs sm:w-52" /></div>
      <div className="flex flex-wrap gap-1.5"><button onClick={() => setBlockCategory("Все блоки")} className={`rounded-full px-3 py-1.5 text-xs ${blockCategory === "Все блоки" ? "bg-violet-700 text-white" : "bg-gray-100 text-gray-600"}`}>Все блоки</button>{Object.keys(nodeCategories).map((name) => <button key={name} onClick={() => setBlockCategory(name)} className={`rounded-full px-3 py-1.5 text-xs ${blockCategory === name ? "bg-violet-700 text-white" : "bg-gray-100 text-gray-600"}`}>{name}</button>)}</div>
      <div className="flex flex-wrap gap-2">{visibleKinds.map(([kind, value]) => <button key={kind} onClick={() => addNode(kind)} className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800">+ {value.icon} {value.title}</button>)}{visibleKinds.length === 0 && <p className="text-xs text-gray-400">Нет блоков по запросу.</p>}</div>
    </section>
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(520px,1fr)_360px]" data-tour-id="scenario-editor">
      <div className="h-[620px] overflow-hidden rounded-2xl border border-gray-200 bg-slate-50 shadow-sm"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={({ nodes: selected }) => setSelectedId(selected[0]?.id || null)} fitView fitViewOptions={{ padding: 0.2 }} deleteKeyCode={["Backspace", "Delete"]}><Background color="#cbd5e1" gap={22} /><MiniMap pannable zoomable /><Controls /></ReactFlow></div>
      <aside className="max-h-[620px] space-y-4 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" data-tour-id="ai-builder-panel">
        <section className="rounded-xl border border-violet-100 bg-violet-50/60 p-3" data-tour-id="ai-builder-panel-inner">
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700">✦</span><div><h2 className="text-sm font-bold text-navy-950">ИИ-конструктор сценария</h2><p className="text-[10px] text-gray-500">ИИ изменяет схему, бот отвечает по ней</p></div></div>
          <div aria-live="polite" className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {aiMessages.length === 0 && <p className="rounded-lg bg-white p-2.5 text-xs leading-5 text-gray-600">Напиши, что нужно построить: «Добавь запись на услугу: спроси дату и телефон, затем покажи контакты».</p>}
            {aiMessages.map((message, index) => <p key={index} className={`whitespace-pre-line rounded-lg p-2.5 text-xs leading-5 ${message.role === "user" ? "ml-5 bg-violet-100 text-violet-950" : "mr-3 bg-white text-gray-700"}`}>{message.text}</p>)}
            {aiBusy && <p className="text-xs text-gray-500">ИИ обновляет узлы и связи…</p>}
          </div>
          <form onSubmit={askAI} className="mt-3 space-y-2"><textarea aria-label="Попросить ИИ изменить сценарий" rows={3} maxLength={2000} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Опиши изменение сценария…" className="w-full resize-y rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs leading-5 outline-none focus:border-violet-400" /><button type="submit" disabled={aiBusy || !aiPrompt.trim()} className="w-full rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{aiBusy ? "Изменяю сценарий…" : "Применить к схеме"}</button></form>
        </section>
        {selectedNode ? <section><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-navy-950">{nodeKinds[selectedNode.data.kind]?.icon} Настройки блока</h2><button onClick={() => { setNodes((current) => current.filter((node) => node.id !== selectedId)); setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(null); }} disabled={selectedNode.data.kind === "start"} className="text-xs text-red-600 disabled:opacity-30">Удалить</button></div><Field label="Название блока" value={selectedNode.data.title || ""} onChange={(value) => updateSelected("title", value)} />{["message", "fallback", "booking", "question", "condition", "delay", "notification", "link", "location", "document", "handoff", "payment", "feedback", "subscribe"].includes(selectedNode.data.kind) && <Field label="Текст / инструкция клиенту" multiline value={selectedNode.data.text || ""} onChange={(value) => updateSelected("text", value)} />}{selectedNode.data.kind === "delay" && <Field label="Пауза в секундах (0–300)" type="number" min={0} max={300} value={selectedNode.data.delaySeconds ?? 5} onChange={(value) => updateSelected("delaySeconds", Math.max(0, Math.min(300, Number(value) || 0)))} />}{selectedNode.data.kind === "condition" && <p className="mt-3 text-xs leading-5 text-gray-500">Этот блок показывает кнопки по всем исходящим связям. Подписи вариантов задаются на линиях между блоками.</p>}{selectedNode.data.kind === "menu" && <p className="mt-3 text-xs leading-5 text-gray-500">Подключи к этому блоку другие узлы. Каждый выход станет кнопкой в меню бота.</p>}{selectedNode.data.kind === "document" && <p className="mt-3 text-xs leading-5 text-gray-500">Файлы и заявки сохраняются в разделе «Входящие». Укажите Telegram ID только если хотите получать дублирующие уведомления в личный Telegram.</p>}{["catalog", "contacts"].includes(selectedNode.data.kind) && <p className="mt-3 text-xs leading-5 text-gray-500">Блок покажет каталог или контакты, которые указаны в настройках бизнеса ниже.</p>}{selectedNode.data.kind === "keyword" && <Field label="Ключевые слова через запятую" value={selectedNode.data.keywords || ""} onChange={(value) => updateSelected("keywords", value)} />}{["link", "payment"].includes(selectedNode.data.kind) && <Field label="HTTPS-ссылка" value={selectedNode.data.url || ""} onChange={(value) => updateSelected("url", value)} />}{selectedNode.data.kind !== "start" && <Field label="Текст кнопки" value={selectedNode.data.buttonLabel || ""} onChange={(value) => updateSelected("buttonLabel", value)} />}</section> : <section><h2 className="text-sm font-bold text-navy-950">Как пользоваться схемой</h2><p className="mt-2 text-xs leading-5 text-gray-500">Перетаскивай узлы по полотну. Потяни за кружок справа у блока, чтобы соединить его с кружком слева у следующего. Нажми на блок для его настройки.</p></section>}
        <section className="border-t border-gray-100 pt-4"><h2 className="text-sm font-bold text-navy-950">Данные бизнеса</h2><Field label="Название" value={businessName} onChange={(value) => setField("businessName", value)} /><Field label="Приветствие /start" multiline value={greeting} onChange={(value) => setField("greeting", value)} /><Field label="Адрес" value={contacts.address} onChange={(value) => setContact("address", value)} /><Field label="График" value={contacts.hours} onChange={(value) => setContact("hours", value)} /><Field label="Телефон" value={contacts.phone} onChange={(value) => setContact("phone", value)} /><Field label="Telegram ID для дополнительных уведомлений" value={ownerTelegramId} onChange={(value) => setField("ownerTelegramId", value.replace(/[^0-9-]/g, "").slice(0, 20))} /><p className="mt-1 text-[11px] leading-4 text-gray-500">Необязательно: укажите ID, если хотите получать копии уведомлений в Telegram. Все обращения доступны в разделе «Входящие».</p></section>
        <section className="border-t border-gray-100 pt-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-navy-950">Товары / услуги · ₸</h2><button onClick={addItem} className="text-xs font-semibold text-accent-600">+ Добавить</button></div>{items.map((item, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_76px_24px] items-center gap-1"><input aria-label="Название товара" value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} className="min-w-0 rounded-lg border border-gray-200 px-2 py-2 text-xs" /><input aria-label="Цена в тенге" type="number" min="0" value={item.price} onChange={(event) => updateItem(index, "price", Number(event.target.value))} className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs" /><button aria-label="Удалить позицию" onClick={() => removeItem(index)} className="text-lg text-red-500">×</button></div>)}<p className="mt-2 text-[11px] leading-4 text-amber-700">Проверь цены: шаблонные позиции — примеры, а не цены твоей компании.</p></section>
      </aside>
    </div>
    {(error || saved) && <p role={error ? "alert" : "status"} className={`mt-3 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{error || saved}</p>}
    {!editing && <p className="mt-3 text-xs text-gray-400">После сценария добавь реальные позиции и контакты, затем запусти бота.</p>}
    {editing && <p className="mt-3 text-xs text-gray-400">Изменения сразу применятся к запущенному боту. ИИ не отвечает на клиентские сообщения.</p>}
    <p className="sr-only">Основа: {category === "custom" ? "пользовательская структура" : templates[category]?.label}; подключённый бот: {botName}</p>
  </div>;
}

function Field({ label, value, onChange, multiline = false, type = "text", min, max }) {
  return <label className="mt-3 block"><span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>{multiline ? <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-accent-500" /> : <input type={type} min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-accent-500" />}</label>;
}
