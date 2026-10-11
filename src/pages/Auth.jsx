import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { supabase, supabaseSetupError } from "../lib/supabase.js";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!supabase) throw new Error(supabaseSetupError());
      const result = mode === "register"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "register" && !result.data.session) {
        setError("Регистрация пока требует подтверждения email. Владелец проекта должен отключить Confirm Email в Supabase: Authentication → Sign In / Providers → Email → Confirm email.");
        return;
      }
      navigate("/overview");
    } catch (exception) {
      const message = String(exception?.message || "");
      if (/email rate limit exceeded|rate limit.*email|email.*rate limit/i.test(message)) {
        setError("Supabase временно ограничил отправку писем подтверждения. Подождите и попробуйте позже. Чтобы пользователи могли регистрироваться без этого ограничения, настройте собственный SMTP-сервис в Supabase: Authentication → SMTP Settings.");
      } else {
        setError(exception instanceof TypeError ? "Сервис авторизации временно не отвечает. Попробуйте позже." : message);
      }
    }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12"><section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm sm:p-10"><Link to="/" className="inline-block"><Logo /></Link><h1 className="mt-8 font-display text-2xl font-bold text-navy-950">{mode === "register" ? "Создайте аккаунт" : "Войдите в аккаунт"}</h1><p className="mt-2 text-sm leading-6 text-gray-500">Вход и аккаунты через Supabase Auth.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-accent-500" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Пароль</span><input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 10 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-accent-500" />{mode === "register" && <span className="mt-1 block text-xs text-gray-400">Не менее 10 символов</span>}</label>{error && <p role="alert" className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button type="submit" disabled={busy} className="w-full rounded-lg bg-navy-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Минуту…" : mode === "register" ? "Создать аккаунт" : "Войти"}</button></form><button onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }} className="mt-5 w-full text-sm font-medium text-accent-600 hover:underline">{mode === "register" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}</button><p className="mt-6 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-400">Создайте Supabase-проект, добавьте URL и publishable/anon key в .env, затем примените supabase/schema.sql.</p></section></main>;
}
