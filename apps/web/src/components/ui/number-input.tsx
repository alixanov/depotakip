import { Minus, Plus } from "lucide-react";
import type { ComponentProps, Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<ComponentProps<"input">, "type" | "onChange" | "value"> {
  value?: number;
  onChange?: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Optional input ref (React 19: ref as prop, no forwardRef). */
  ref?: Ref<HTMLInputElement>;
  /** Localised stepper labels — defaults to common i18n keys. */
  decrementLabel?: string;
  incrementLabel?: string;
}

/**
 * Touch-friendly number input with explicit +/- steppers + arrow-key
 * support. Used for shipment item qty, exchange rate cents etc.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  disabled,
  ref,
  decrementLabel,
  incrementLabel,
  ...props
}: NumberInputProps) {
  const { t } = useTranslation();
  const dec = decrementLabel ?? t("decrease");
  const inc = incrementLabel ?? t("increase");

  const clamp = (n: number) => {
    if (typeof min === "number") n = Math.max(min, n);
    if (typeof max === "number") n = Math.min(max, n);
    return n;
  };
  const change = (delta: number) => {
    const base = typeof value === "number" && !Number.isNaN(value) ? value : 0;
    onChange?.(clamp(Math.round((base + delta) * 1e6) / 1e6));
  };

  return (
    <div
      className={cn(
        "inline-flex h-11 w-full items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-soft",
        "focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
        // Mirror Input's aria-invalid treatment so RHF errors carry the same
        // visual language across all field primitives.
        "has-[input[aria-invalid='true']]:border-destructive has-[input[aria-invalid='true']]:focus-within:ring-destructive/20",
        "transition-[box-shadow,border-color] duration-150",
        disabled && "opacity-50",
        className
      )}
    >
      <button
        type="button"
        onClick={() => change(-step)}
        disabled={disabled || (typeof min === "number" && (value ?? 0) <= min)}
        className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        aria-label={dec}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value === "" ? 0 : Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="flex-1 border-x bg-transparent px-3 text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...props}
      />
      <button
        type="button"
        onClick={() => change(step)}
        disabled={disabled || (typeof max === "number" && (value ?? 0) >= max)}
        className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        aria-label={inc}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
