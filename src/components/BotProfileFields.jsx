import { useEffect, useMemo, useState } from "react";
import { useCreateBot } from "../context/CreateBotContext.jsx";
import { useSitePreferences } from "../context/SitePreferencesContext.jsx";
import { compressProfilePhoto, readBotProfile, writeBotProfile } from "../lib/bot-profile.js";

const emptyProfile = { name: "", description: "", shortDescription: "", profilePhoto: null };

export default function BotProfileFields() {
  const { botId, botName, userId } = useCreateBot();
  const { t } = useSitePreferences();
  const storageKey = useMemo(() => `${userId || "anonymous"}:${botId || "none"}`, [userId, botId]);
  const [profile, setProfile] = useState(() => ({ ...emptyProfile, ...readBotProfile(userId, botId) }));
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => { setProfile({ ...emptyProfile, ...readBotProfile(userId, botId) }); }, [storageKey, userId, botId]);

  function update(field, value) {
    setProfile((current) => {
      const next = { ...current, [field]: value };
      if (!next.name && botName) next.name = botName;
      writeBotProfile(userId, botId, next);
      return next;
    });
  }

  async function selectPhoto(file) {
    setError("");
    if (!file) return;
    setPhotoBusy(true);
    try {
      const photo = await compressProfilePhoto(file);
      setProfile((current) => { const next = { ...current, profilePhoto: photo }; writeBotProfile(userId, botId, next); return next; });
    } catch (exception) { setError(exception.message); }
    finally { setPhotoBusy(false); }
  }

  const effectiveName = profile.name || botName || "";
  return <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-5 sm:p-6">
    <div><p className="text-sm font-bold text-navy-950">{t("Профиль бота в Telegram")}</p><p className="mt-1 text-xs leading-5 text-gray-500">{t("Оформите страницу бота: имя, описание и фото. Профиль применится к Telegram при запуске.")}</p></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid gap-3">
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("Отображаемое имя")}</span><input value={effectiveName} onChange={(event) => update("name", event.target.value.slice(0, 64))} maxLength={64} placeholder={botName || "Например, Coffee House"} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent-500"/><span className="mt-1 block text-right text-[10px] text-gray-400">{effectiveName.length}/64</span></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("Краткое описание")}</span><textarea value={profile.shortDescription || ""} onChange={(event) => update("shortDescription", event.target.value.slice(0, 120))} maxLength={120} rows={2} placeholder={t("Короткий текст в профиле бота") } className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent-500"/><span className="mt-1 block text-right text-[10px] text-gray-400">{(profile.shortDescription || "").length}/120</span></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("Описание профиля")}</span><textarea value={profile.description || ""} onChange={(event) => update("description", event.target.value.slice(0, 512))} maxLength={512} rows={3} placeholder={t("Чем помогает бот и что можно в нём сделать") } className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent-500"/><span className="mt-1 block text-right text-[10px] text-gray-400">{(profile.description || "").length}/512</span></label>
      </div>
      <div className="flex flex-col items-center gap-2 sm:w-36">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-violet-200 bg-white text-3xl text-violet-300 shadow-sm">{profile.profilePhoto?.dataUrl ? <img src={profile.profilePhoto.dataUrl} alt={t("Аватар бота")} className="h-full w-full object-cover"/> : <span aria-hidden="true">🤖</span>}</div>
        <label className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-xs font-semibold text-navy-950 hover:border-violet-300">{photoBusy ? t("Обрабатываем фото…") : profile.profilePhoto ? t("Заменить фото") : t("Выбрать аватар")}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={photoBusy} onChange={(event) => { selectPhoto(event.target.files?.[0]); event.target.value = ""; }}/>
        </label>
        {profile.profilePhoto && <button type="button" onClick={() => update("profilePhoto", null)} className="text-xs font-medium text-red-600 hover:underline">{t("Удалить фото")}</button>}
        <span className="text-center text-[10px] leading-4 text-gray-500">{t("JPG, PNG или WebP. Фото будет передано Telegram только при запуске.")}</span>
      </div>
    </div>
    <p className="mt-4 rounded-xl border border-violet-100 bg-white/80 p-3 text-[11px] leading-5 text-gray-600">{t("Telegram поддерживает смену имени, описания и фотографии профиля через Bot API. Фото временно хранится в черновике этого браузера и передаётся серверу платформы только при запуске.")}</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
  </section>;
}
