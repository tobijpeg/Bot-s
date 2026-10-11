import { Link, useLocation } from "react-router-dom";

const steps = [
  { path: "/create/token", title: "Подключение", caption: "Токен BotFather" },
  { path: "/create/describe", title: "Шаблон и описание", caption: "Подготовим сценарий" },
  { path: "/create/structure", title: "Возможности", caption: "Настроим функции" },
  { path: "/create/flow", title: "Сценарий", caption: "Соединим блоки" },
  { path: "/create/setup", title: "Содержание", caption: "Товары и контакты" },
  { path: "/create/launch", title: "Публикация", caption: "Проверка и запуск" },
];

export default function CreateBotProgress() {
  const { pathname } = useLocation();
  const current = Math.max(0, steps.findIndex((step) => pathname.startsWith(step.path)));
  return (
    <div className="mb-7 max-w-5xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-navy-950">Настройка Telegram-бота</p><p className="mt-1 text-xs text-gray-400">Помощник проведёт вас через каждый шаг</p></div>
        <span className="rounded-full bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-600">Шаг {current + 1} из {steps.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {steps.map((step, index) => (
          <Link key={step.path} to={step.path} className="group min-w-0 text-left">
            <div className={`mb-2 h-1.5 rounded-full ${index <= current ? "bg-accent-500" : "bg-gray-100"}`} />
            <p className={`truncate text-xs font-semibold ${index === current ? "text-navy-950" : index < current ? "text-accent-600" : "text-gray-400"}`}>{step.title}</p>
            <p className="mt-0.5 hidden truncate text-[11px] text-gray-400 sm:block">{step.caption}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
