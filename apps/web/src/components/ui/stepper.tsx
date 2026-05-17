import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: ReactNode;
  description?: ReactNode;
}

interface StepperProps {
  steps: Step[];
  current: number;
  onStepClick?: (idx: number) => void;
  className?: string;
}

/**
 * Horizontal stepper with animated progress fill between steps. Used by
 * multi-step forms (wizards) for clear navigation feedback. Clickable
 * to allow revisiting earlier steps (Linear-style).
 */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === steps.length - 1;
        const canNavigate = onStepClick && i <= current;
        return (
          <li key={s.key} className="flex flex-1 items-start last:flex-none">
            <button
              type="button"
              onClick={canNavigate ? () => onStepClick(i) : undefined}
              disabled={!canNavigate}
              className={cn(
                "flex flex-col items-center gap-1.5 text-center transition-colors",
                canNavigate ? "cursor-pointer" : "cursor-default",
                !canNavigate && !done && "opacity-60"
              )}
            >
              <span
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ease-spring",
                  done &&
                    "bg-gradient-to-br from-primary to-primary/70 text-white shadow-brand-glow",
                  active && "bg-card text-primary ring-2 ring-primary shadow-soft-md",
                  !done && !active && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-1 animate-status-ping rounded-full bg-primary/40"
                  />
                )}
              </span>
              <div className="min-w-0 px-1">
                <p
                  className={cn(
                    "text-xs font-semibold tracking-tight transition-colors",
                    done || active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </p>
                {s.description && (
                  <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
                    {s.description}
                  </p>
                )}
              </div>
            </button>
            {!isLast && (
              <div className="mx-2 mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-spring"
                  style={{ width: done ? "100%" : active ? "50%" : "0%" }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
