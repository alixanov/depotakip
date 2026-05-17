import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions slot (buttons, filters, etc.) */
  actions?: ReactNode;
  /** Optional badge/eyebrow above the title (e.g. section tag) */
  eyebrow?: ReactNode;
  className?: string;
}

/**
 * Consistent page header pattern used across all routes. Mirrors
 * Linear/Notion-style top-of-page section: eyebrow → title → subtitle
 * with a right-aligned actions cluster.
 */
export function PageHeader({ title, subtitle, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
