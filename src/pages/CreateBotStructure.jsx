import { useNavigate } from "react-router-dom";
import CreateBotProgress from "../components/CreateBotProgress.jsx";
import { useCreateBot } from "../context/CreateBotContext.jsx";

export default function CreateBotStructure() {
  const navigate = useNavigate();
  const { category, description, features, toggleFeature } = useCreateBot();
  const suggested = category === "shop" ? ["Каталог товаров", "Корзина и заявки", "Доставка по Казахстану", "Частые вопросы", "Уведомления о заказах"] : category === "cafe" ? ["Меню и цены", "Предзаказ", "Бронь столика", "Часы работы и адрес", "Акции и уведомления"] : ["Запись клиентов", "Услуги и цены", "Выбор мастера", "Напоминания о визите", "Частые вопросы"];
  return <div>
    <CreateBotProgress />
    <div className="max-w-4xl rounded-2xl bg-white p-7 shadow-sm sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">План создан на основе вашего описания</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-navy-950">Выберите возможности бота</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Для старта подготовили подходящий набор функций. Выберите нужные — настройки можно изменить позже.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{suggested.map((feature) => <label key={feature} className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 hover:border-accent-500/40"><span className="text-sm font-medium text-navy-950">{feature}</span><input type="checkbox" checked={features.includes(feature)} onChange={() => toggleFeature(feature)} className="h-5 w-5 accent-[#4a7dc4]" /></label>)}</div>
      <div className="mt-6 rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold text-navy-950">✦ ИИ помогает владельцу настроить бота</p><p className="mt-1 text-xs leading-5 text-gray-600">Перейди к визуальному полотну сценария, добавь нужные блоки и соедини их. ИИ помогает только при создании; ответы клиентам выполняются по твоему сценарию.</p></div>
      <div className="mt-7 flex justify-between"><button onClick={() => navigate("/create/describe")} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-gray-50">Назад</button><button onClick={() => navigate("/create/flow")} className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-900">Собрать сценарий блоками →</button></div>
      <p className="mt-5 truncate text-xs text-gray-400">Описание: {description}</p>
    </div>
  </div>;
}
