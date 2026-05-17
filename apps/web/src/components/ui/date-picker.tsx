import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type DateRange } from "react-day-picker";
import { Calendar, X } from "lucide-react";
import { ru, tr, uz } from "date-fns/locale";
import "react-day-picker/style.css";
import { useUiStore } from "@/stores/ui";
import { formatDate, isoDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

const LOCALES = { tr, ru, uz } as const;

interface DatePickerProps {
  value?: string;
  onChange: (iso: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Single-date picker. Replaces native input[type=date] — gives full
 * theming control + i18n + arrow-key navigation + accessible roles.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "—",
  className,
  disabled,
}: DatePickerProps) {
  const lang = useUiStore((s) => s.lang);
  const locale = LOCALES[lang];
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm shadow-soft",
            "transition-colors hover:border-foreground/20",
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {selected ? formatDate(selected) : placeholder}
          </span>
          {selected && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-2xl border bg-popover p-3 shadow-soft-lg data-[state=open]:animate-scale-in"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              onChange(d ? isoDateOnly(d) : undefined);
              setOpen(false);
            }}
            locale={locale as never}
            captionLayout="dropdown"
            classNames={DP_CLASSNAMES}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface DateRangePickerProps {
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
  placeholder?: string;
  className?: string;
}

/** Two-month range picker — perfect for report filters. */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "—",
  className,
}: DateRangePickerProps) {
  const lang = useUiStore((s) => s.lang);
  const locale = LOCALES[lang];
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined =
    from || to
      ? {
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        }
      : undefined;

  const label = !range?.from
    ? placeholder
    : range.to
      ? `${formatDate(range.from)} → ${formatDate(range.to)}`
      : formatDate(range.from);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-11 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm shadow-soft",
            "transition-colors hover:border-foreground/20",
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
            !range?.from && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {label}
          </span>
          {range?.from && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange({});
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-2xl border bg-popover p-3 shadow-soft-lg data-[state=open]:animate-scale-in"
        >
          <DayPicker
            mode="range"
            selected={range}
            onSelect={(r) =>
              onChange({
                from: r?.from ? isoDateOnly(r.from) : undefined,
                to: r?.to ? isoDateOnly(r.to) : undefined,
              })
            }
            numberOfMonths={2}
            locale={locale as never}
            classNames={DP_CLASSNAMES}
            className="hidden sm:block"
          />
          <DayPicker
            mode="range"
            selected={range}
            onSelect={(r) =>
              onChange({
                from: r?.from ? isoDateOnly(r.from) : undefined,
                to: r?.to ? isoDateOnly(r.to) : undefined,
              })
            }
            numberOfMonths={1}
            locale={locale as never}
            classNames={DP_CLASSNAMES}
            className="sm:hidden"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Reusable className overrides for react-day-picker v9. */
const DP_CLASSNAMES: Partial<Record<string, string>> = {
  root: "rdp-root text-sm",
  month_caption: "flex items-center justify-center py-1 text-sm font-semibold",
  weekday: "w-9 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
  day: "h-9 w-9 rounded-md text-sm font-medium hover:bg-muted",
  day_button: "h-9 w-9 rounded-md",
  selected: "bg-primary text-primary-foreground hover:bg-primary",
  today: "font-bold text-primary",
  range_middle: "bg-primary-soft text-primary-soft-foreground rounded-none hover:bg-primary-soft",
  range_start: "bg-primary text-primary-foreground rounded-r-none hover:bg-primary",
  range_end: "bg-primary text-primary-foreground rounded-l-none hover:bg-primary",
  outside: "text-muted-foreground/50",
  disabled: "opacity-40 cursor-not-allowed",
  chevron: "h-4 w-4 fill-current text-muted-foreground",
  nav: "absolute right-2 top-1 flex gap-1",
  button_previous: "h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center",
  button_next: "h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center",
};
