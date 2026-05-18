import { useEffect, useRef, type ComponentProps, type Ref } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "size"> {
  /** Render the "partial selection" minus-glyph (when not fully checked). */
  indeterminate?: boolean;
  /** Visual size of the box itself. Defaults to "md" (16×16). */
  size?: "sm" | "md" | "lg";
  /** Optional ref forwarded to the underlying input (React 19: ref as prop). */
  ref?: Ref<HTMLInputElement>;
}

const SIZES = {
  sm: { box: "h-3.5 w-3.5", icon: "h-2.5 w-2.5" },
  md: { box: "h-4 w-4", icon: "h-3 w-3" },
  lg: { box: "h-5 w-5", icon: "h-3.5 w-3.5" },
} as const;

/**
 * Brand-styled checkbox built on a native <input type="checkbox">. The input
 * itself is visually hidden via `peer sr-only`; the painted box + check/minus
 * icons sit next to it as siblings (so Tailwind `peer-*` variants — which
 * only see preceding siblings — can react to checked / indeterminate / focus
 * / disabled state without any JS.
 *
 * Why a native input rather than a Radix-style div+role="checkbox":
 *   - `useForm().register("foo")` from react-hook-form just works
 *   - Space-to-toggle, form submission, screen-reader announcements are free
 *   - One less Radix dependency to keep in sync with React 19
 *
 * Indeterminate is a DOM property only (no HTML attribute), so we set it
 * imperatively in an effect.
 */
export function Checkbox({
  className,
  indeterminate = false,
  size = "md",
  checked,
  defaultChecked,
  disabled,
  ref,
  ...props
}: CheckboxProps) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  // Merge caller's ref with our internal one so the indeterminate sync works
  // even when the parent attaches its own ref (e.g. RHF's `register`).
  const setRef = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as { current: HTMLInputElement | null }).current = el;
  };

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const s = SIZES[size];

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <input
        ref={setRef}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        {...props}
      />

      {/* Box — reacts to peer (input) state */}
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-md border border-input bg-background shadow-soft transition-all duration-150",
          s.box,
          "peer-hover:border-foreground/30 peer-hover:shadow-soft-md",
          "peer-focus-visible:border-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15",
          "peer-checked:border-primary peer-checked:bg-primary",
          "peer-[:indeterminate]:border-primary peer-[:indeterminate]:bg-primary",
          "peer-aria-invalid:border-destructive peer-aria-invalid:peer-focus-visible:ring-destructive/20",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        )}
      />

      {/* Glyph layer — absolutely positioned, visibility driven by peer state */}
      <Check
        aria-hidden="true"
        strokeWidth={3.5}
        className={cn(
          "pointer-events-none absolute text-primary-foreground transition-all duration-150",
          s.icon,
          "scale-0 opacity-0",
          "peer-checked:scale-100 peer-checked:opacity-100",
          // Hidden when in indeterminate state (the minus shows instead).
          "peer-[:indeterminate]:scale-0 peer-[:indeterminate]:opacity-0"
        )}
      />
      <Minus
        aria-hidden="true"
        strokeWidth={3.5}
        className={cn(
          "pointer-events-none absolute text-primary-foreground transition-all duration-150",
          s.icon,
          "scale-0 opacity-0",
          "peer-[:indeterminate]:scale-100 peer-[:indeterminate]:opacity-100"
        )}
      />
    </span>
  );
}
