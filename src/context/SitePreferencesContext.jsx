import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translate } from "../i18n.js";

const PreferencesContext = createContext(null);
const LANGUAGE_KEY = "bots-kz-language-v1";
const THEME_KEY = "bots-kz-theme-v1";
const read = (key, fallback, allowed) => {
  try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : fallback; }
  catch { return fallback; }
};

export function SitePreferencesProvider({ children }) {
  const [language, setLanguage] = useState(() => read(LANGUAGE_KEY, "ru", ["ru", "kk", "en"]));
  const [theme, setTheme] = useState(() => read(THEME_KEY, "light", ["light", "dark"]));
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(LANGUAGE_KEY, language); localStorage.setItem(THEME_KEY, theme); } catch { /* Preferences still apply for this session. */ }
  }, [language, theme]);
  const value = useMemo(() => ({ language, setLanguage, theme, setTheme, t: (text) => translate(language, text) }), [language, theme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSitePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("useSitePreferences must be used inside SitePreferencesProvider");
  return context;
}

