import { useEffect, useState } from "react";
import { Check, ChevronDown, Globe, Moon, Sun, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlagIcon } from "@/components/ui/flag-icon";
import { setLanguage, type AppLocale } from "@/lib/i18n";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

type Variant = "surface" | "inverse";

interface LanguageMeta {
  code: AppLocale;
  native: string;
  english: string;
}

/** 3 supported app locales, ordered as in the original switcher (TR first). */
const LANGUAGES: LanguageMeta[] = [
  { code: "tr", native: "Türkçe", english: "Turkish" },
  { code: "ru", native: "Русский", english: "Russian" },
  { code: "uz", native: "Oʻzbekcha", english: "Uzbek" },
];

const LANG_BY_CODE: Record<AppLocale, LanguageMeta> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l])
) as Record<AppLocale, LanguageMeta>;

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
  const { t } = useTranslation();
  const current = LANG_BY_CODE[lang];
  const isInverse = variant === "inverse";

  const choose = (next: AppLocale) => {
    if (next === lang) return;
    setLang(next);
    setLanguage(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("cmd:lang", { code: current.code.toUpperCase() })}
          className={cn(
            "group inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            isInverse
              ? "border-white/25 bg-white/10 text-white hover:bg-white/20 data-[state=open]:bg-white/25"
              : "border-input bg-background text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary-soft-foreground data-[state=open]:border-primary/40 data-[state=open]:bg-primary-soft data-[state=open]:text-primary-soft-foreground"
          )}
        >
          <Globe className="hidden h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100 sm:inline" />
          <span
            aria-hidden="true"
            className={cn(
              "flex h-3.5 w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[3px] ring-1 ring-inset",
              isInverse ? "ring-white/30" : "ring-border"
            )}
          >
            <FlagIcon code={current.code} className="h-full w-full" />
          </span>
          {/* On mobile (<sm) we collapse to flag-only so the header fits at
              375px without the avatar getting clipped — Globe + "TR" + chevron
              alone consume ~70px. The dropdown still opens via the button. */}
          <span className="hidden tabular-nums tracking-wide sm:inline">
            {current.code.toUpperCase()}
          </span>
          <ChevronDown
            className="hidden h-3 w-3 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180 sm:inline"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5" role="radiogroup">
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            {t("cmd:lang", { code: current.code.toUpperCase() }).split(":")[0]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        {LANGUAGES.map((l) => {
          const active = l.code === lang;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(l.code)}
              className={cn(
                "group/item flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:bg-muted",
                active
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "hover:bg-muted hover:text-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset transition-all",
                  active
                    ? "ring-primary/40 shadow-sm"
                    : "ring-border group-hover/item:ring-foreground/20"
                )}
              >
                {/* Flag SVG is 3:2 — overflow-hidden + h-full crops to a clean circle */}
                <FlagIcon code={l.code} className="h-full w-auto min-w-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-semibold leading-tight",
                    active ? "text-primary" : "text-foreground"
                  )}
                >
                  {l.native}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                  {l.english}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                  active
                    ? "scale-100 bg-primary text-primary-foreground opacity-100"
                    : "scale-50 opacity-0"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
