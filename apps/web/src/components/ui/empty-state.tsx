import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Friendly empty-state placeholder — replaces flat "Henüz X yok" text
 * across all tables/lists. Big circular icon halo, title, supporting copy,
 * optional CTA.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 p-10 text-center", className)}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <span className="[&>svg]:h-6 [&>svg]:w-6">{icon}</span>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
