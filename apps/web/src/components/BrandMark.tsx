import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Visual height/width in px. The mark is rendered as a square. */
  size?: number;
  /** Show the rounded brand container around the mark. Default true. */
  withContainer?: boolean;
  className?: string;
  /** Optional accessible label. Set to "" to mark as decorative. */
  label?: string;
}

/**
 * Sadiya Kargo logomark.
 *
 * Composition:
 *   1. Flowing S-curve, drawn as a single continuous cubic-bezier line —
 *      the seamless delivery journey from sender to recipient.
 *   2. Selçuklu yıldızı (the Seljuk eight-pointed star) at the pivot —
 *      a historic ornament shared across Anatolia and Turkic Central
 *      Asia, signalling heritage, trust and "sa'ada" (благополучие).
 *
 * Set `withContainer={false}` to drop the rounded brand square and have the
 * mark inherit `currentColor` — useful inside coloured buttons or stamps.
 */
export function BrandMark({
  size = 32,
  withContainer = true,
  className,
  label = "Sadiya Kargo",
}: BrandMarkProps) {
  const ariaProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  const strokeColor = withContainer ? "#FFFFFF" : "currentColor";
  const starFill = withContainer ? "url(#brandmark-gold)" : "currentColor";
  const medallionFill = withContainer ? "#1E3A8A" : "transparent";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={cn("shrink-0", className)}
      {...ariaProps}
    >
      {label ? <title>{label}</title> : null}
      <defs>
        <linearGradient id="brandmark-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#312E81" />
        </linearGradient>
        <linearGradient id="brandmark-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {withContainer && <rect width="512" height="512" rx="112" fill="url(#brandmark-bg)" />}

      {/* Flowing S */}
      <path
        d="M 416 160
           C 416 64, 96 64, 96 192
           C 96 256, 416 256, 416 320
           C 416 448, 96 448, 96 352"
        stroke={strokeColor}
        strokeWidth="48"
        strokeLinecap="round"
        fill="none"
      />

      {/* Selçuklu yıldızı */}
      <g transform="translate(256 256)">
        <rect x="-52" y="-52" width="104" height="104" rx="14" fill={starFill} />
        <rect
          x="-52"
          y="-52"
          width="104"
          height="104"
          rx="14"
          fill={starFill}
          transform="rotate(45)"
        />
        <circle r="22" fill={medallionFill} />
        <circle r="10" fill={starFill} />
      </g>
    </svg>
  );
}

/**
 * Sadiya Kargo typographic wordmark.
 * Pairs with <BrandMark/> or stands alone in textual contexts. Inherits the
 * page font stack and uses theme tokens so it works under any theme.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-1.5 leading-none", className)}>
      <span className="text-gradient-brand font-extrabold tracking-tight">Sadiya</span>
      <span className="text-[0.6em] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        Kargo
      </span>
    </span>
  );
}
