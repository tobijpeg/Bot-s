import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-10 py-4">
        <Logo />
        <nav className="flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-navy-950">
            Возможности
          </a>
          <a href="#pricing" className="hover:text-navy-950">
            Цены
          </a>
          <Link to="/overview" className="hover:text-navy-950">
            Войти
          </Link>
          <Link
            to="/auth?mode=register"
            className="rounded-lg bg-navy-950 px-4 py-2 text-white transition-colors hover:bg-navy-900"
          >
            Начать бесплатно
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-10 py-24 md:grid-cols-2">
        <div>
          <h1 className="font-display text-5xl font-extrabold leading-tight text-navy-950">
            Ваш бизнес в Telegram — на русском и казахском
          </h1>
          <p className="mt-6 max-w-md text-gray-500">
            Подключите бота из BotFather, выберите шаблон для магазина, кафе
            или услуг и подготовьте сценарий общения шаг за шагом.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
            to="/auth"
              className="rounded-lg bg-navy-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
            >
              Создать бота
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-navy-950 hover:bg-white"
            >
              Как это работает
            </a>
          </div>
        </div>

        <div className="rounded-xl2 bg-white p-6 shadow-sm">
          <p className="mb-3 text-xs font-medium text-gray-400">Пример</p>
          <div className="mb-3 ml-auto max-w-[85%] rounded-xl bg-[#1D6FA5] px-4 py-3 text-sm text-white">
  У меня салон красоты. Нужен бот для записи и напоминаний.
</div>

          <div className="max-w-[85%] rounded-xl bg-gray-100 px-4 py-3 text-sm text-navy-950">
            Шаблон подготовит каталог, заявки и ответы на частые вопросы. Добавьте
            описание вашего бизнеса и настройте всё под себя.
          </div>
        </div>
      </section>
      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-10 pb-16 md:grid-cols-3">
        {[{ emoji: "🛍️", title: "Магазин", copy: "Каталог, заявки и доставка по Казахстану." }, { emoji: "✂️", title: "Услуги", copy: "Запись, прайс и напоминания клиентам." }, { emoji: "☕", title: "Кафе", copy: "Меню, предзаказ и бронь столика." }].map((card) => <div key={card.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><span className="text-2xl">{card.emoji}</span><h2 className="mt-3 font-display text-lg font-bold text-navy-950">{card.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{card.copy}</p></div>)}
      </section>
    </div>
  );
}
