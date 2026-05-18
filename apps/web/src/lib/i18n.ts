import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./i18n.locales/ru.json";
import tr from "./i18n.locales/tr.json";
import uz from "./i18n.locales/uz.json";

const resources = { tr, ru, uz } as const;

export type AppLocale = "tr" | "ru" | "uz";

const STORAGE_KEY = "sadiyakargo_lang";
const fallback: AppLocale = "tr";

function readInitialLanguage(): AppLocale {
  // Vite SPA, без SSR — localStorage всегда доступен.
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "ru" || saved === "uz" || saved === "tr") return saved;
  return fallback;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: readInitialLanguage(),
  fallbackLng: fallback,
  ns: Object.keys(tr),
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function setLanguage(code: AppLocale): void {
  void i18n.changeLanguage(code);
  localStorage.setItem(STORAGE_KEY, code);
}

/** Maps app locale to BCP-47 used by Intl formatters. */
export const LOCALE_BCP47: Record<AppLocale, string> = {
  tr: "tr-TR",
  ru: "ru-RU",
  uz: "uz-UZ",
};

export default i18n;
