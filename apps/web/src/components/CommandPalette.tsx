import { Command } from "cmdk";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Coins,
  FileBarChart,
  Moon,
  Package,
  ScrollText,
  Search,
  ShieldCheck,
  Sun,
  Truck,
  Users as UsersIcon,
  UserCircle,
  Warehouse,
  Languages,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useAuthStore } from "@/stores/auth";
import { useUiStore, applyTheme } from "@/stores/ui";
import { setLanguage, type AppLocale } from "@/lib/i18n";
import { searchApi } from "@/lib/api/search";
import { cn } from "@/lib/utils";

/**
 * Global ⌘K command palette — fuzzy search + navigation + actions.
 * Listens for ⌘K (mac) / Ctrl+K everywhere. Optionally listens for /.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setTheme = useUiStore((s) => s.setTheme);
  const theme = useUiStore((s) => s.theme);

  const debounced = useDebouncedValue(query, 200);
  const remote = useQuery({
    queryKey: ["cmd-search", debounced],
    queryFn: () => searchApi.query(debounced, 6),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 5_000,
  });

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const go = (to: string) => {
    close();
    requestAnimationFrame(() => navigate({ to }));
  };

  const canMutate = user?.role !== "viewer";
  const isAdmin = user?.role === "admin";

  const navItems = useMemo(
    () => [
      { key: "/", label: t("nav:home"), icon: BarChart3 },
      { key: "/depo", label: t("nav:warehouse"), icon: Warehouse },
      ...(canMutate ? [{ key: "/cikis", label: t("nav:ship"), icon: Truck }] : []),
      { key: "/takip", label: t("nav:track"), icon: Package },
      { key: "/finans", label: t("nav:finance"), icon: Coins },
      { key: "/raporlar", label: t("nav:reports"), icon: FileBarChart },
      { key: "/profile", label: t("profile"), icon: UserCircle },
    ],
    [t, canMutate]
  );

  const adminItems = useMemo(
    () =>
      [
        canMutate && { key: "/admin/senders", label: t("nav:senders"), icon: UsersIcon },
        canMutate && { key: "/admin/carriers", label: t("nav:carriers"), icon: Truck },
        isAdmin && { key: "/admin/exchange-rates", label: t("nav:rates"), icon: Coins },
        isAdmin && { key: "/admin/users", label: t("nav:users"), icon: ShieldCheck },
        isAdmin && { key: "/admin/notifications", label: t("nav:notifications"), icon: Bell },
        isAdmin && { key: "/admin/audit", label: t("nav:audit"), icon: ScrollText },
      ].filter(Boolean) as { key: string; label: string; icon: typeof BarChart3 }[],
    [t, canMutate, isAdmin]
  );

  return (
    <>
      {/* Trigger pill — visible in header on md+ */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("cmd:open")}
        className={cn(
          "group hidden h-9 items-center gap-2 rounded-lg border border-input bg-background/60 px-2.5 text-xs text-muted-foreground shadow-soft transition-colors hover:bg-muted lg:flex"
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="font-medium">{t("cmd:trigger")}</span>
        <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Mobile / icon-only trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("cmd:open")}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">{t("cmd:open")}</DialogTitle>
          <Command shouldFilter={true} className="flex flex-col" label={t("cmd:open")}>
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("cmd:placeholder")}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                autoFocus
              />
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-flex">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {t("notFound")}
              </Command.Empty>

              {/* Remote search results */}
              {remote.data && remote.data.length > 0 && (
                <Command.Group
                  heading={
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("cmd:results")}
                    </span>
                  }
                >
                  {remote.data.map((hit) => {
                    const path =
                      hit.type === "shipment"
                        ? "/takip"
                        : hit.type === "carrier"
                          ? "/admin/carriers"
                          : "/admin/senders";
                    const Icon =
                      hit.type === "shipment"
                        ? Package
                        : hit.type === "carrier"
                          ? Truck
                          : UsersIcon;
                    return (
                      <CommandItem
                        key={`${hit.type}-${hit.id}`}
                        onSelect={() => go(path)}
                        icon={<Icon className="h-4 w-4" />}
                        label={hit.title}
                        hint={hit.subtitle}
                        tag={t(`search:type_${hit.type}`)}
                      />
                    );
                  })}
                </Command.Group>
              )}

              {/* Navigations */}
              <Command.Group
                heading={
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("cmd:navigate")}
                  </span>
                }
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.key}
                      onSelect={() => go(item.key)}
                      icon={<Icon className="h-4 w-4" />}
                      label={item.label}
                      keywords={[item.key]}
                    />
                  );
                })}
              </Command.Group>

              {adminItems.length > 0 && (
                <Command.Group
                  heading={
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("nav:users")}
                    </span>
                  }
                >
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.key}
                        onSelect={() => go(item.key)}
                        icon={<Icon className="h-4 w-4" />}
                        label={item.label}
                      />
                    );
                  })}
                </Command.Group>
              )}

              <Command.Group
                heading={
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("cmd:actions")}
                  </span>
                }
              >
                <CommandItem
                  onSelect={() => {
                    const next = theme === "dark" ? "light" : "dark";
                    setTheme(next);
                    applyTheme(next);
                  }}
                  icon={
                    theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
                  }
                  label={theme === "dark" ? t("cmd:theme_light") : t("cmd:theme_dark")}
                />
                {(["tr", "ru", "uz"] as AppLocale[]).map((code) => (
                  <CommandItem
                    key={code}
                    onSelect={() => {
                      setLanguage(code);
                      close();
                    }}
                    icon={<Languages className="h-4 w-4" />}
                    label={t("cmd:lang", { code: code.toUpperCase() })}
                    tag={i18n.language === code ? "✓" : undefined}
                  />
                ))}
              </Command.Group>
            </Command.List>

            <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                <kbd className="mr-1 rounded border border-border bg-card px-1 py-0.5 font-mono">
                  ↑↓
                </kbd>
                {t("cmd:hint_navigate")}
              </span>
              <span>
                <kbd className="mr-1 rounded border border-border bg-card px-1 py-0.5 font-mono">
                  ↵
                </kbd>
                {t("cmd:hint_select")}
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommandItem({
  onSelect,
  icon,
  label,
  hint,
  tag,
  keywords,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  tag?: string;
  keywords?: string[];
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      value={`${label} ${keywords?.join(" ") ?? ""}`}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm outline-none",
        "data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary-soft-foreground"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {tag && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tag}
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}
