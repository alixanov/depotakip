import type { Currency, Money } from "@sadiyakargo/shared";
import { useUiStore } from "@/stores/ui";
import { LOCALE_BCP47 } from "./i18n";

const DEFAULT_LOCALE = "tr-TR";

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
export function formatMoney(minor: number, currency: Currency, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
}

/** Format a Money object directly. */
export function formatMoneyObject(m: Money, locale = DEFAULT_LOCALE): string {
  return formatMoney(m.amount, m.currency, locale);
}

/** Format USD-cents (raw integer) — used in balances/reports. */
export function formatUsdCents(cents: number, locale = DEFAULT_LOCALE): string {
  return formatMoney(cents, "USD", locale);
}

/**
 * Compact money format for KPI tiles where space is precious — large UZS
 * amounts (e.g. 12,500,000 → "12,5M") via native Intl notation.
 */
export function formatMoneyCompact(
  minor: number,
  currency: Currency,
  locale = DEFAULT_LOCALE
): string {
  const value = fromMinor(minor);
  if (Math.abs(value) < 10_000) return formatMoney(minor, currency, locale);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatUsdCentsCompact(cents: number, locale = DEFAULT_LOCALE): string {
  return formatMoneyCompact(cents, "USD", locale);
}

export function formatDate(iso: string | Date, locale = DEFAULT_LOCALE): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string | Date, locale = DEFAULT_LOCALE): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

/** "2 saat önce", "yarın", "şimdi". Falls back to a date if delta exceeds 30 days. */
export function formatRelativeTime(iso: string | Date, locale = "tr"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffSec = (Date.now() - d.getTime()) / 1000;
  const absSec = Math.abs(diffSec);
  const sign = diffSec >= 0 ? -1 : 1;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absSec < 5) return locale === "tr" ? "şimdi" : "now";
  if (absSec < 60) return rtf.format(sign * Math.round(absSec), "second");
  if (absSec < 3600) return rtf.format(sign * Math.round(absSec / 60), "minute");
  if (absSec < 86400) return rtf.format(sign * Math.round(absSec / 3600), "hour");
  if (absSec < 86400 * 30) return rtf.format(sign * Math.round(absSec / 86400), "day");
  return formatDate(d);
}

/** ISO yyyy-mm-dd string for <input type="date"> defaults. */
export function isoDateOnly(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
