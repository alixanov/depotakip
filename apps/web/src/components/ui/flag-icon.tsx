import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type FlagCode = "tr" | "ru" | "uz";

interface FlagIconProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  code: FlagCode;
}

/**
 * Inline SVG country flags for the languages we support. Cross-platform stable
 * (emoji flags don't render on Windows), pixel-crisp at any size, and easy to
 * theme. Aspect ratio is the official 2:3, drawn in a 24×16 viewBox so the
 * SVG tiles cleanly next to lucide icons.
 *
 * Wrap in a container with `rounded-sm overflow-hidden` for clipped corners.
 */
export function FlagIcon({ code, className, ...rest }: FlagIconProps) {
  return (
    <svg
      viewBox="0 0 24 16"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block", className)}
      {...rest}
    >
      {code === "tr" && <TurkeyFlag />}
      {code === "ru" && <RussiaFlag />}
      {code === "uz" && <UzbekistanFlag />}
    </svg>
  );
}

function TurkeyFlag() {
  return (
    <>
      <rect width="24" height="16" fill="#E30A17" />
      {/* Crescent: white disc with red disc on top, offset right */}
      <circle cx="9" cy="8" r="3.2" fill="#FFFFFF" />
      <circle cx="9.9" cy="8" r="2.5" fill="#E30A17" />
      {/* 5-point star, centred at (14, 8), outer radius 1.7 */}
      <path
        d="M14 6.3 L14.5 7.55 L15.85 7.65 L14.8 8.5 L15.15 9.85 L14 9.05 L12.85 9.85 L13.2 8.5 L12.15 7.65 L13.5 7.55 Z"
        fill="#FFFFFF"
      />
    </>
  );
}

function RussiaFlag() {
  return (
    <>
      <rect y="0" width="24" height="5.333" fill="#FFFFFF" />
      <rect y="5.333" width="24" height="5.334" fill="#0039A6" />
      <rect y="10.667" width="24" height="5.333" fill="#D52B1E" />
    </>
  );
}

function UzbekistanFlag() {
  return (
    <>
      {/* Top: turquoise blue */}
      <rect y="0" width="24" height="5" fill="#0099B5" />
      {/* Thin red separator */}
      <rect y="5" width="24" height="0.5" fill="#CE1126" />
      {/* Middle: white */}
      <rect y="5.5" width="24" height="5" fill="#FFFFFF" />
      {/* Thin red separator */}
      <rect y="10.5" width="24" height="0.5" fill="#CE1126" />
      {/* Bottom: green */}
      <rect y="11" width="24" height="5" fill="#1EB53A" />
      {/* Crescent in canton (top-left), white on blue */}
      <circle cx="5.2" cy="2.5" r="1.2" fill="#FFFFFF" />
      <circle cx="5.7" cy="2.5" r="0.95" fill="#0099B5" />
      {/* Two of the 12 stars — full constellation would be unreadable at 16px */}
      <circle cx="7.6" cy="2.1" r="0.28" fill="#FFFFFF" />
      <circle cx="7.6" cy="3" r="0.28" fill="#FFFFFF" />
    </>
  );
}
