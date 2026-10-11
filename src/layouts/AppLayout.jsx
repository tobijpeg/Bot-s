import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import ProductTour from "../components/ProductTour.jsx";
import { supabase } from "../lib/supabase.js";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(undefined);
  const [profileState, setProfileState] = useState("checking");
  useEffect(() => {
    if (!supabase) { setUser(null); return undefined; }
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) { setProfileState(user === null ? "signed-out" : "checking"); return undefined; }
    let active = true;
    async function loadProfile() {
      setProfileState("checking");
      const { data, error } = await supabase.from("onboarding_responses").select("user_id,tour_completed").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (error) { setProfileState("unavailable"); return; }
      setProfileState(data ? (data.tour_completed ? "complete" : "tour-pending") : "missing");
    }
    loadProfile();
    const onCompleted = () => setProfileState("tour-pending");
    const onTourCompleted = () => setProfileState("complete");
    window.addEventListener("bots:onboarding-completed", onCompleted);
    window.addEventListener("bots:tour-completed", onTourCompleted);
    return () => { active = false; window.removeEventListener("bots:onboarding-completed", onCompleted); window.removeEventListener("bots:tour-completed", onTourCompleted); };
  }, [user]);
  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-gray-500">Проверяем вход…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (profileState === "checking") return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-gray-500">Готовим рабочее пространство…</div>;
  if (profileState === "missing" && location.pathname !== "/welcome") return <Navigate to="/welcome" replace />;
  if (profileState === "complete" && location.pathname === "/welcome") return <Navigate to="/overview" replace />;
  if (profileState === "tour-pending" && location.pathname !== "/welcome" && new URLSearchParams(location.search).get("tour") !== "1") return <Navigate to="/overview?tour=1" replace />;
  async function logout() { await supabase.auth.signOut(); navigate("/auth"); }
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <main className="min-w-0 flex-1 px-10 py-8">
        <div className="mb-5 flex justify-end gap-3 text-xs text-gray-500"><span>{user.email}</span><button onClick={logout} className="font-semibold text-accent-600 hover:underline">Выйти</button></div>
        {profileState === "unavailable" && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Анкета и экскурсия пока не подключены к базе. Примените актуальную миграцию Supabase, чтобы включить новые возможности.</p>}
        <Outlet />
      </main>
      <ProductTour />
    </div>
  );
}
