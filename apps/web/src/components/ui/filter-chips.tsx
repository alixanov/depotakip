import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface FilterChip {
  /** Unique key for the chip (used for React key). */
  key: string;
  /** Short label shown in the chip — e.g. "Durum: Yolda". */
  label: ReactNode;
  /** Clear handler for this single chip. */
  onClear: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  /** Clear-all handler — only shown when ≥2 chips. */
  onClearAll?: () => void;
  className?: string;
}

/**
 * Compact toolbar above tables — surfaces every active filter as a pill
 * with X. Massively improves discoverability of what's filtering the
 * current view, and lets the user reset with one click.
 */
export function FilterChips({ chips, onClearAll, className }: FilterChipsProps) {
  const { t } = useTranslation();
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onClear}
          className={cn(
            "group inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft pl-2.5 pr-1.5 text-xs font-medium text-primary-soft-foreground",
            "transition-colors hover:bg-primary/20"
          )}
        >
          <span>{c.label}</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 transition-colors group-hover:bg-primary/30">
            <X className="h-2.5 w-2.5" />
          </span>
        </button>
      ))}
      {chips.length >= 2 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("filters:clear_all")}
        </button>
      )}
    </div>
  );
}
