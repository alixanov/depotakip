import type { Currency, Money } from "@sadiyakargo/shared";
import { useUiStore } from "@/stores/ui";
import i18n, { LOCALE_BCP47, type AppLocale } from "./i18n";

const DEFAULT_LOCALE = "tr-TR";

/** Resolve a BCP-47 locale from the current i18n language, defaulting to TR.
 *  Used by formatters that aren't called from the `useFormatters` hook so the
 *  output (e.g. "2 saat önce") still respects the user's language switch. */
function activeBcp47(): string {
  const lang = i18n.language as AppLocale | undefined;
  return (lang && LOCALE_BCP47[lang]) || DEFAULT_LOCALE;
}

/**
 * React hook for components that need locale-aware formatters.
 * Re-renders when user switches language via LanguageSwitcher.
 */
export function useFormatters() {
  const lang = useUiStore((s) => s.lang);
  const locale = LOCALE_BCP47[lang];
  return {
    formatMoney: (minor: number, currency: Currency) => formatMoney(minor, currency, locale),
    formatUsdCents: (cents: number) => formatUsdCents(cents, locale),
    formatDate: (iso: string | Date) => formatDate(iso, locale),
    formatDateTime: (iso: string | Date) => formatDateTime(iso, locale),
    formatRelativeTime: (iso: string | Date) => formatRelativeTime(iso, lang),
  };
}

/** Convert display units (e.g. 50.00 USD) to minor units (e.g. 5000 cents). */
export function toMinor(display: number): number {
  return Math.round(display * 100);
}

/** Convert minor units to display units. */
export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Format a minor-unit amount as a currency string. */
export function formatMoney(minor: number, currency: Currency, locale?: string): string {
  return new Intl.NumberFormat(locale ?? activeBcp47(), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
}

/** Format a Money object directly. */
export function formatMoneyObject(m: Money, locale?: string): string {
  return formatMoney(m.amount, m.currency, locale);
}

/** Format USD-cents (raw integer) — used in balances/reports. */
export function formatUsdCents(cents: number, locale?: string): string {
  return formatMoney(cents, "USD", locale);
}

/**
 * Compact money format for KPI tiles where space is precious — large UZS
 * amounts (e.g. 12,500,000 → "12,5M") via native Intl notation.
 */
export function formatMoneyCompact(minor: number, currency: Currency, locale?: string): string {
  const effective = locale ?? activeBcp47();
  const value = fromMinor(minor);
  if (Math.abs(value) < 10_000) return formatMoney(minor, currency, effective);
  return new Intl.NumberFormat(effective, {
    style: "currency",
    currency,
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatUsdCentsCompact(cents: number, locale?: string): string {
  return formatMoneyCompact(cents, "USD", locale);
}

export function formatDate(iso: string | Date, locale?: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(locale ?? activeBcp47(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | Date, locale?: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(locale ?? activeBcp47(), { dateStyle: "short", timeStyle: "short" });
}

/** Locale-aware "just now" label for the < 5s edge case where Intl.RTF doesn't
 *  give a nice phrasing. Keys map to the AppLocale set used elsewhere. */
const JUST_NOW: Record<AppLocale, string> = {
  tr: "şimdi",
  ru: "только что",
  uz: "hozir",
};

/**
 * "2 часа назад" / "2 saat önce" / "2 soat oldin" relative-time formatter.
 * `locale` accepts either an AppLocale (tr|ru|uz) or a raw BCP-47 string. When
 * omitted it follows the currently active i18n language so call-sites that
 * don't go through `useFormatters` still localise correctly.
 * Falls back to an absolute date for deltas above 30 days.
 */
export function formatRelativeTime(iso: string | Date, locale?: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffSec = (Date.now() - d.getTime()) / 1000;
  const absSec = Math.abs(diffSec);
  const sign = diffSec >= 0 ? -1 : 1;

  const appLocale = (locale as AppLocale | undefined) ?? (i18n.language as AppLocale | undefined);
  const bcp47 =
    appLocale && LOCALE_BCP47[appLocale] ? LOCALE_BCP47[appLocale] : (locale ?? activeBcp47());
  const rtf = new Intl.RelativeTimeFormat(bcp47, { numeric: "auto" });

  if (absSec < 5) {
    return appLocale && JUST_NOW[appLocale] ? JUST_NOW[appLocale] : JUST_NOW.tr;
  }
  if (absSec < 60) return rtf.format(sign * Math.round(absSec), "second");
  if (absSec < 3600) return rtf.format(sign * Math.round(absSec / 60), "minute");
  if (absSec < 86400) return rtf.format(sign * Math.round(absSec / 3600), "hour");
  if (absSec < 86400 * 30) return rtf.format(sign * Math.round(absSec / 86400), "day");
  return formatDate(d, bcp47);
}

/** ISO yyyy-mm-dd string for <input type="date"> defaults. */
export function isoDateOnly(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
