import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = RDialog.Root;
export const SheetTrigger = RDialog.Trigger;
export const SheetClose = RDialog.Close;
export const SheetTitle = RDialog.Title;
export const SheetDescription = RDialog.Description;

type Side = "right" | "left" | "top" | "bottom";

const SIDE_CLASSES: Record<Side, string> = {
  right:
    "right-0 top-0 h-full w-full max-w-md border-l data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  left: "left-0 top-0 h-full w-full max-w-md border-r data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  top: "top-0 left-0 right-0 max-h-[90vh] border-b data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
  bottom:
    "bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
};

interface SheetContentProps extends ComponentProps<typeof RDialog.Content> {
  side?: Side;
  /** Render the X close button (top-right). Default true. */
  showClose?: boolean;
}

/**
 * Sheet slides in from an edge — replaces full-screen Dialog on mobile
 * (use `side="bottom"`) and is the right pattern for side-edits on
 * desktop (`side="right"`).
 */
export function SheetContent({
  side = "right",
  showClose = true,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        )}
      />
      <RDialog.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-card p-6 shadow-soft-lg outline-none",
          SIDE_CLASSES[side],
          className
        )}
        {...props}
      >
        {side === "bottom" && (
          <div
            aria-hidden="true"
            className="mx-auto -mt-2 mb-1 h-1.5 w-10 rounded-full bg-border"
          />
        )}
        {children}
        {showClose && (
          <RDialog.Close
            aria-label="Kapat"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </RDialog.Close>
        )}
      </RDialog.Content>
    </RDialog.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
