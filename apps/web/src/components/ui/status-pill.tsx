import { useTranslation } from "react-i18next";
import type { LotStatus, Status, StatusTone } from "@sadiyakargo/shared";
import { LOT_STATUS_TONE, STATUS_TONE } from "@sadiyakargo/shared";
import { cn } from "@/lib/utils";

/** Dark-theme aware tone → Tailwind classes. */
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 ring-slate-200/60 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700/60",
  warning:
    "bg-amber-100 text-amber-800 ring-amber-200/60 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/40",
  success:
    "bg-emerald-100 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/40",
  danger:
    "bg-rose-100 text-rose-800 ring-rose-200/60 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800/40",
  info: "bg-violet-100 text-violet-800 ring-violet-200/60 dark:bg-violet-900/30 dark:text-violet-200 dark:ring-violet-800/40",
  muted:
    "bg-zinc-200 text-zinc-700 ring-zinc-300/60 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/60",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  info: "bg-violet-500",
  muted: "bg-zinc-400",
};

interface ShipmentStatusPillProps {
  status: Status;
  className?: string;
  full?: boolean;
  /** Show animated ping dot — perfect for "yolda" / live indicators. */
  withDot?: boolean;
}

export function StatusPill({ status, className, full, withDot }: ShipmentStatusPillProps) {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status];
  const labelKey = full ? `status:${status}_full` : `status:${status}`;
  const fallback = t(`status:${status}`);
  const label = full ? t(labelKey, { defaultValue: fallback }) : fallback;
  // Always pulse on "yolda" (in transit) unless explicitly opted out.
  const animated = withDot ?? (status === "yolda" || status === "bekliyor");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_CLASSES[tone],
        className
      )}
    >
      {animated && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-75 animate-status-ping",
              DOT_CLASSES[tone]
            )}
          />
          <span
            className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])}
          />
        </span>
      )}
      {label}
    </span>
  );
}

interface LotStatusPillProps {
  status: LotStatus;
  className?: string;
}

export function LotStatusPill({ status, className }: LotStatusPillProps) {
  const { t } = useTranslation();
  const tone = LOT_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} />
      {t(`depo:status_${status}`)}
    </span>
  );
}
