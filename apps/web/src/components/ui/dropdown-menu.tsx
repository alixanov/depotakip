import * as RMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = RMenu.Root;
export const DropdownMenuTrigger = RMenu.Trigger;
export const DropdownMenuGroup = RMenu.Group;
export const DropdownMenuPortal = RMenu.Portal;
export const DropdownMenuSub = RMenu.Sub;
export const DropdownMenuRadioGroup = RMenu.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof RMenu.Content>) {
  return (
    <RMenu.Portal>
      <RMenu.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft-lg",
          "data-[state=open]:animate-scale-in",
          className
        )}
        {...props}
      />
    </RMenu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof RMenu.Item> & { inset?: boolean }) {
  return (
    <RMenu.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "focus:bg-accent/15 focus:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof RMenu.CheckboxItem>) {
  return (
    <RMenu.CheckboxItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none",
        "focus:bg-accent/15 focus:text-foreground",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RMenu.ItemIndicator>
          <Check className="h-4 w-4" />
        </RMenu.ItemIndicator>
      </span>
      {children}
    </RMenu.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof RMenu.RadioItem>) {
  return (
    <RMenu.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none",
        "focus:bg-accent/15 focus:text-foreground",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RMenu.ItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </RMenu.ItemIndicator>
      </span>
      {children}
    </RMenu.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof RMenu.Label> & { inset?: boolean }) {
  return (
    <RMenu.Label
      className={cn(
        "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof RMenu.Separator>) {
  return <RMenu.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof RMenu.SubTrigger> & { inset?: boolean }) {
  return (
    <RMenu.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none",
        "focus:bg-accent/15 focus:text-foreground data-[state=open]:bg-accent/15",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </RMenu.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof RMenu.SubContent>) {
  return (
    <RMenu.SubContent
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft-lg",
        "data-[state=open]:animate-scale-in",
        className
      )}
      {...props}
    />
  );
}
