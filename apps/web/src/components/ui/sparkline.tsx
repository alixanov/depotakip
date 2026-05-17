import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Override stroke + fill via CSS variable hsl token (e.g. "primary"). */
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
  /** Show subtle area gradient under the line. */
  area?: boolean;
}

const TONE_VAR: Record<NonNullable<SparklineProps["tone"]>, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  muted: "var(--muted-foreground)",
};

/**
 * Inline SVG sparkline — sub-100-byte, no recharts overhead. Perfect for
 * KPI cards / inline list trends. Tone-aware (semantic colour), optional
 * area gradient fill.
 */
export function Sparkline({
  data,
  width = 100,
  height = 28,
  className,
  tone = "primary",
  area = true,
}: SparklineProps) {
  const { path, areaPath } = useMemo(() => {
    if (!data || data.length < 2) return { path: "", areaPath: "" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return [x, y] as const;
    });
    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(" ");
    const areaPath = `${path} L${width.toFixed(1)},${height} L0,${height} Z`;
    return { path, areaPath };
  }, [data, width, height]);

  if (!path) return <div className={cn("h-7", className)} aria-hidden="true" />;

  const stroke = `hsl(${TONE_VAR[tone]})`;
  const gradId = `sg-${tone}-${data.length}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("text-current", className)}
      aria-hidden="true"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
