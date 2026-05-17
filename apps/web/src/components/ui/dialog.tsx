import type { ComponentProps, ReactNode } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

interface DialogContentProps extends ComponentProps<typeof RDialog.Content> {
  children?: ReactNode;
}

export function DialogContent({ className, children, ...props }: DialogContentProps) {
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
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4",
          "border bg-card p-6 shadow-soft-lg rounded-2xl",
          "data-[state=open]:animate-scale-in",
          className
        )}
        {...props}
      >
        {children}
        <RDialog.Close
          aria-label="Kapat"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </RDialog.Close>
      </RDialog.Content>
    </RDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col space-y-1.5", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof RDialog.Title>) {
  return (
    <RDialog.Title
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof RDialog.Description>) {
  return (
    <RDialog.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
