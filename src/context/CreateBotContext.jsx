import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createDefaultWorkflow } from "../workflow.js";
import { supabase } from "../lib/supabase.js";
import { readWorkspace, writeWorkspace } from "../workspace-storage.js";

const legacyStorageKey = "bots-kz-workspace-v1";
const templates = {
  shop: {
    label: "Магазин",
    emoji: "🛍️",
    description: "Онлайн-магазин одежды и аксессуаров в Алматы. Каталог товаров, заказ через Telegram, доставка по Казахстану и ответы на вопросы на русском и казахском.",
    features: ["Каталог товаров", "Корзина и заявки", "Доставка по Казахстану", "Частые вопросы", "Уведомления о заказах"],
    items: [{ name: "Футболка базовая", price: 9900 }, { name: "Сумка шоппер", price: 7500 }, { name: "Кепка", price: 6500 }],
    greeting: "Сәлем! Здравствуйте! Добро пожаловать в наш магазин. Выберите товар в каталоге или задайте вопрос — поможем на русском и казахском.",
  },
  beauty: {
    label: "Салон и услуги",
    emoji: "✂️",
    description: "Салон красоты в Алматы. Запись к мастерам, услуги и цены, напоминания о визите и ответы клиентам на русском и казахском языках.",
    features: ["Запись клиентов", "Услуги и цены", "Выбор мастера", "Напоминания о визите", "Частые вопросы"],
    items: [{ name: "Женская стрижка", price: 8000 }, { name: "Маникюр", price: 10000 }, { name: "Укладка", price: 7000 }],
    greeting: "Сәлеметсіз бе! Здравствуйте! Поможем записаться, посмотреть цены и выбрать удобное время.",
  },
  cafe: {
    label: "Кафе и доставка еды",
    emoji: "☕",
    description: "Кофейня в Алматы. Меню, предварительный заказ и бронь столика. Работаем на русском и казахском, доставка по ближайшим районам.",
    features: ["Меню и цены", "Предзаказ", "Бронь столика", "Часы работы и адрес", "Акции и уведомления"],
    items: [{ name: "Капучино", price: 1600 }, { name: "Завтрак дня", price: 3200 }, { name: "Чизкейк", price: 2400 }],
    greeting: "Сәлем! Здравствуйте! Посмотрите меню, закажите заранее или забронируйте столик.",
  },
};

function getInitialState(userId) {
  try {
    const saved = readWorkspace(userId) || {};
    const category = saved.category === "custom" ? "custom" : templates[saved.category] ? saved.category : "shop";
    const base = templates[category] || templates.shop;
    return { category, description: saved.description || (category === "custom" ? "" : base.description), businessName: saved.businessName || "", features: saved.features || (category === "custom" ? [] : base.features), items: saved.items || (category === "custom" ? [] : base.items), contacts: saved.contacts || { hours: "Ежедневно, 10:00–20:00", address: "", phone: "", language: "Русский и казахский" }, ownerTelegramId: saved.ownerTelegramId || "", workflow: saved.workflow || createDefaultWorkflow(), botId: saved.botId || "", botUsername: saved.botUsername || "", botName: saved.botName || "", verified: false, status: saved.status || "Черновик", greeting: saved.greeting || (category === "custom" ? "Здравствуйте! Добро пожаловать. Выберите действие, чтобы продолжить." : base.greeting), aiPlan: saved.aiPlan || null };
  } catch {
    return { category: "shop", description: templates.shop.description, businessName: "", features: templates.shop.features, items: templates.shop.items, contacts: { hours: "Ежедневно, 10:00–20:00", address: "", phone: "", language: "Русский и казахский" }, ownerTelegramId: "", workflow: createDefaultWorkflow(), botId: "", botUsername: "", botName: "", verified: false, status: "Черновик", greeting: templates.shop.greeting };
  }
}

const CreateBotContext = createContext(null);

export function CreateBotProvider({ children }) {
  const [userId, setUserId] = useState(undefined);
  const [loadedUserId, setLoadedUserId] = useState(undefined);
  const [state, setState] = useState(() => getInitialState(null));
  useEffect(() => {
    if (!supabase) { setUserId(null); return undefined; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setUserId(data.session?.user?.id || null); }).catch(() => { if (active) setUserId(null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id || null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (userId === undefined) return;
    setState(getInitialState(userId));
    setLoadedUserId(userId);
    if (userId) localStorage.removeItem(legacyStorageKey);
  }, [userId]);
  useEffect(() => {
    if (!userId || loadedUserId !== userId) return;
    const safeState = Object.fromEntries(Object.entries(state).filter(([key]) => key !== "verified"));
    writeWorkspace(userId, safeState);
  }, [state, userId, loadedUserId]);

  const actions = useMemo(() => ({
    setField: (field, value) => setState((prev) => ({ ...prev, [field]: value })),
    setContact: (field, value) => setState((prev) => ({ ...prev, contacts: { ...prev.contacts, [field]: value } })),
    toggleFeature: (feature) => setState((prev) => ({ ...prev, features: prev.features.includes(feature) ? prev.features.filter((item) => item !== feature) : [...prev.features, feature] })),
    applyAiPlan: (plan) => setState((prev) => ({ ...prev, greeting: plan.greeting || prev.greeting })),
    setWorkflowPlan: (plan) => setState((prev) => ({ ...prev, greeting: plan.greeting || prev.greeting, features: plan.features || prev.features, aiPlan: plan })),
    updateItem: (index, field, value) => setState((prev) => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item) })),
    removeItem: (index) => setState((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) })),
    addItem: () => setState((prev) => ({ ...prev, items: [...prev.items, { name: "Новый товар или услуга", price: 0 }] })),
    chooseTemplate: (category) => { const template = templates[category]; setState((prev) => ({ ...prev, category, description: template.description, features: template.features, items: template.items, greeting: template.greeting, workflow: createDefaultWorkflow(), aiPlan: null, status: "Черновик" })); },
    chooseCustom: () => setState((prev) => ({ ...prev, category: "custom", features: [], items: [], greeting: "Здравствуйте! Добро пожаловать. Выберите действие, чтобы продолжить.", workflow: createDefaultWorkflow(), aiPlan: null, status: "Черновик" })),
    setState,
  }), []);

  if (userId === undefined || loadedUserId !== userId) return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-gray-500">Подготавливаем рабочее пространство…</div>;
  return <CreateBotContext.Provider value={{ ...state, ...actions, templates }}>{children}</CreateBotContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCreateBot() {
  const context = useContext(CreateBotContext);
  if (!context) throw new Error("useCreateBot must be used inside <CreateBotProvider>");
  return context;
}
