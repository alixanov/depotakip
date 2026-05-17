import * as RAvatar from "@radix-ui/react-avatar";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const AVATAR_PALETTE = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-lime-500 to-emerald-500",
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorForName(name: string): string {
  return AVATAR_PALETTE[hash(name) % AVATAR_PALETTE.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps extends ComponentProps<typeof RAvatar.Root> {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const SIZE_CLS: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const gradient = colorForName(name);
  return (
    <RAvatar.Root
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        SIZE_CLS[size],
        className
      )}
      {...props}
    >
      {src && (
        <RAvatar.Image src={src} alt={name} className="aspect-square h-full w-full object-cover" />
      )}
      <RAvatar.Fallback
        delayMs={300}
        className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}
      >
        {initialsOf(name)}
      </RAvatar.Fallback>
    </RAvatar.Root>
  );
}
