import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { apiFetch } from "../lib/api.js";
import Logo from "./Logo.jsx";

const links = [
  { to: "/overview", label: "Обзор" },
  { to: "/create/token", label: "Создать бота", matchPrefix: "/create" },
  { to: "/bots", label: "Мои боты" },
  { to: "/inbox", label: "Входящие" },
  { to: "/settings", label: "Настройки" },
];

export default function Sidebar() {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const response = await apiFetch("/api/inbox", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
        if (!response.ok) return;
        const result = await response.json();
        if (active) setUnreadCount((result.conversations || []).reduce((sum, conversation) => sum + Number(conversation.unread_count || 0), 0));
      } catch { /* Keep the last unread count while the API is temporarily offline. */ }
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    const checkAdmin = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const response = await apiFetch("/api/admin/check", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
        if (response.ok) { const result = await response.json(); if (active) setIsAdmin(Boolean(result.isAdmin)); }
      } catch { /* The admin link stays hidden if the API is unreachable. */ }
    };
    checkAdmin();
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!supabase) return <aside className="w-60 shrink-0 border-r border-gray-200 bg-white px-4 py-6"><div className="px-2"><Logo /></div><div className="mt-8 rounded-xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Подключите Supabase</p><p className="mt-2 text-xs leading-5 text-amber-900">Создайте .env из .env.example, укажите URL и publishable key, примените supabase/schema.sql и перезапустите приложение.</p></div></aside>;

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="mt-8 flex flex-col gap-1">
        {[...links, ...(isAdmin ? [{ to: "/admin/onboarding", label: "Анкеты пользователей" }] : [])].map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => {
              const active =
                isActive || (link.matchPrefix && location.pathname.startsWith(link.matchPrefix));
              return [
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-500/10 text-accent-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-navy-950",
              ].join(" ");
            }}
          >
            <span>{link.label}</span>
            {link.to === "/inbox" && unreadCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-violet-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
