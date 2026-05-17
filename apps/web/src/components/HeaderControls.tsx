import { useEffect, useState } from "react";
import { Moon, Sun, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { setLanguage } from "@/lib/i18n";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

type Variant = "surface" | "inverse";

/**
 * `surface` = default header on light/dark app background.
 * `inverse` = placed on the brand-gradient hero (login). Forces white glyph
 * + transparent-white hover so it reads on coloured surfaces.
 */
export function ThemeToggle({ variant = "surface" }: { variant?: Variant }) {
  const theme = useUiStore((s) => s.theme);
  const toggle = useUiStore((s) => s.toggleTheme);
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn(variant === "inverse" && "text-white hover:bg-white/15")}
      aria-label={theme === "dark" ? t("cmd:theme_light") : t("cmd:theme_dark")}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function LanguageSwitcher({ variant = "surface" }: { variant?: Variant }) {
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  return (
    <select
      value={lang}
      onChange={(e) => {
        const next = e.target.value as "tr" | "ru" | "uz";
        setLang(next);
        setLanguage(next);
      }}
      className={cn(
        "h-9 rounded-md border px-2 text-xs font-semibold",
        variant === "inverse"
          ? "border-white/30 bg-white/15 text-white"
          : "border-input bg-background text-foreground"
      )}
    >
      <option value="tr">TR</option>
      <option value="ru">RU</option>
      <option value="uz">UZ</option>
    </select>
  );
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-xs font-semibold text-white">
      <WifiOff className="h-3 w-3" /> {t("offline")}
    </div>
  );
}
