import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  /** Final numeric value. */
  value: number;
  /** Duration in ms. */
  duration?: number;
  /** Optional formatter (e.g. money). Receives the in-flight value. */
  format?: (n: number) => string;
  /** Decimals when no formatter supplied. */
  decimals?: number;
}

/**
 * Tweens a number from previous → value with ease-out. Used by KPI cards
 * on the dashboard. Respects `prefers-reduced-motion` by jumping straight
 * to value. Stores the "from" point in a ref so the effect's dep array
 * stays exhaustive without re-triggering on every paint.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  format,
  decimals = 0,
}: AnimatedNumberProps) {
  const [current, setCurrent] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (typeof window === "undefined") {
      setCurrent(value);
      fromRef.current = value;
      return;
    }
    const prefersReduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setCurrent(value);
      fromRef.current = value;
      return;
    }

    let raf: number;
    let start: number | null = null;
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) {
      setCurrent(value);
      return;
    }

    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const next = from + delta * eased;
      setCurrent(next);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (format) return <>{format(current)}</>;
  return <>{current.toFixed(decimals)}</>;
}
