import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormError({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p className={cn("rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive", className)}>
      {children}
    </p>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}
