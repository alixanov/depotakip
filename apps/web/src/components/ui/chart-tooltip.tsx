import type { TooltipProps } from "recharts";
import { cn } from "@/lib/utils";

/**
 * Brand-styled Recharts tooltip. Replaces the default white box with a
 * card-like surface that matches Card / Popover and respects dark theme.
 */
export function BrandTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipProps<number, string> & {
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card p-2.5 text-card-foreground shadow-soft-lg">
      {label && (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className={cn("h-2 w-2 rounded-full")}
              style={{ background: entry.color ?? "var(--color-primary)" }}
            />
            <span className="font-medium">
              {formatter && entry.value != null
                ? formatter(entry.value as number, entry.name as string)
                : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
