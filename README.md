# Bot(s) KZ

Веб-конструктор Telegram-ботов для малого и среднего бизнеса. Интерфейс собирается как статический сайт, а API, ИИ и запущенные Telegram-боты работают на сервере платформы.

## Архитектура

- **Frontend:** React + Vite; публикуется на GitHub Pages.
- **API и Telegram polling:** сервер Node.js (можно запустить напрямую или в Docker). Запуск и редакторские изменения отправляют конфигурацию на API; работающий бот перезапускается с новой схемой.
- **Аккаунты и данные:** Supabase Auth и таблицы приложения. Telegram-токены шифруются AES-256-GCM до записи в закрытую таблицу `bot_secrets`.
- **ИИ конструктора:** Ollama на сервере. ИИ помогает владельцу строить сценарий и не отвечает клиентам бота. Квота задаётся на стороне базы.

Пользователю сайта нужны аккаунт и браузер. Для работы ботов сервер платформы должен оставаться запущенным и иметь постоянный доступ к Telegram API и Supabase. Ollama нужна только для функций ИИ-конструктора.

## Разработка

Нужен Node.js 20 или новее. Docker для сервера не обязателен.

```powershell
npm ci
npm run dev
```

Локальный UI открывается на `http://127.0.0.1:5173`, API — на `http://127.0.0.1:4174`. Локальные переменные окружения хранятся в `.env`; используйте `.env.example` как перечень настроек.

## Запуск API без Docker на Windows

Установите Node.js с [официального сайта](https://nodejs.org/) и Git, затем откройте PowerShell:

```powershell
git clone https://github.com/tobijpeg/Bot-s.git
cd Bot-s
npm ci
npm run build
Copy-Item .env.docker.example .env
notepad .env
```

В `.env` заполните `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` и `BOT_TOKEN_ENCRYPTION_KEY`. Для последнего создайте ключ командой `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` и сохраните значение в `.env`. Замените `APP_PORT=4174` на `BOTSUITE_PORT=4174`. Оставьте `PUBLIC_APP_ORIGIN=https://tobijpeg.github.io`; `OLLAMA_URL` не задавайте, если ИИ не нужен. Не отправляйте содержимое `.env` в чат и не добавляйте его в GitHub.

Запустите API и оставьте это окно PowerShell открытым:

```powershell
npm start
```

В другом окне PowerShell поднимите временный HTTPS-туннель к API командой `cloudflared tunnel --url http://localhost:4174`. Установщик `cloudflared` для Windows доступен в [официальной инструкции Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/). Скопируйте выданный адрес `https://….trycloudflare.com`.

В настройках GitHub **Settings → Secrets and variables → Actions → Variables** задайте `VITE_API_BASE_URL` равным этому HTTPS-адресу (без `/` в конце). Проверьте, что заданы `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`, затем запустите workflow **Deploy GitHub Pages**. Если Quick Tunnel перезапущен, его адрес изменится: обновите `VITE_API_BASE_URL` и повторно запустите workflow.

Quick Tunnel бесплатный, временный и предназначен для демонстраций и разработки: адрес действует только пока запущено окно туннеля, а компьютер должен оставаться включённым и быть в интернете. Поэтому перед защитой проверьте запуск API, туннеля, вход в приложение и реальные сценарии с тестовым Telegram-ботом. Согласуйте постоянную работу и установку программ с владельцем чужого компьютера.

## Запуск сервисов в Docker

Скопируйте `.env.docker.example` в `.env` рядом с `docker-compose.yml`, заполните серверные переменные окружения и выполните:

```powershell
docker compose up -d --build
```

По умолчанию запускается API без ИИ — этого достаточно для хранения данных и работы Telegram-ботов. Чтобы включить ИИ-конструктор, укажите `OLLAMA_URL=http://ollama:11434` в `.env` и выполните `docker compose --profile ai up -d --build`; при первом запуске Compose скачает модель `OLLAMA_MODEL`. Данные API и модели сохраняются в Docker volumes. Не удаляйте volume `platform_data`: он содержит ключ, нужный для расшифровки уже сохранённых Telegram-токенов.

## Supabase

Для нового проекта выполните `supabase/schema.sql` в SQL Editor. Для существующей базы примените недостающие миграции из `supabase/migrations` по порядку; обязательно включите `202610070005_fix_inbox_upsert_ambiguity.sql` и `202610120006_fix_send_inbox_reply_ambiguity.sql`. Нужны URL проекта, publishable key для клиента и secret key только в окружении сервера. Укажите `ADMIN_EMAIL` в серверном `.env`, чтобы открыть администраторскую страницу анкет.

В Supabase Auth настройте email-подтверждение, SMTP и URL перенаправления под выбранный адрес сайта. Для GitHub Pages URL сайта — `https://tobijpeg.github.io/Bot-s/`, а `PUBLIC_APP_ORIGIN` — только origin `https://tobijpeg.github.io` без пути `/Bot-s/`. Не помещайте Supabase secret key, ключ шифрования или Telegram-токены в frontend, GitHub Pages или репозиторий.

## Публикация

GitHub Pages размещает только интерфейс. Для ботов нужен постоянно работающий сервер с Docker, HTTPS-адрес API и проект Supabase. На сервере храните Supabase secret key и постоянный `BOT_TOKEN_ENCRYPTION_KEY`; не добавляйте их в GitHub Variables или репозиторий. На GitHub в **Settings → Secrets and variables → Actions → Variables** задайте `VITE_API_BASE_URL` (HTTPS-адрес API без завершающего `/`), `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`, затем перезапустите workflow **Deploy GitHub Pages**. `PUBLIC_APP_ORIGIN` должен быть ровно `https://tobijpeg.github.io`: браузер отправляет origin без пути `/Bot-s/`.

## Проверки

```powershell
npm test
npm run lint
npm run build
node --check server.js
```

После сохранения редактора конфигурация хранится в Supabase. Если бот остановлен, запустите его через страницу «Мои боты». Сообщения, заявки, геолокация и файлы клиентов сохраняются в разделе «Входящие» и доступны владельцу для ответа из браузера. Новые пользователи проходят короткую анкету и интерактивную экскурсию по кабинету. Ответы видны только администратору, чей адрес задан серверной переменной `ADMIN_EMAIL`. Владельцы могут сохранять собственные последовательности блоков в личную библиотеку и повторно использовать их. Приложения и документы доступны в «Входящих»; личный Telegram ID нужен только для дополнительных уведомлений.
