import { useEffect, useState } from "react";
import { createRootRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  ChevronDown,
  Coins,
  FileBarChart,
  LayoutGrid,
  LogOut,
  Package,
  ScrollText,
  ShieldCheck,
  Truck,
  Users as UsersIcon,
  UserCircle,
  Warehouse,
} from "lucide-react";
import type { User } from "@sadiyakargo/shared";
import { BrandMark } from "@/components/BrandMark";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth";
import { useLogout } from "@/lib/useLogout";
import { useRealtimeInvalidations } from "@/lib/realtime";
import { CommandPalette } from "@/components/CommandPalette";
import { LanguageSwitcher, OfflineBanner, ThemeToggle } from "@/components/HeaderControls";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorPage } from "@/components/ErrorPage";
import { cn } from "@/lib/utils";

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
  notFoundComponent: () => <ErrorPage error={new Error("404 — Not Found")} />,
});

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/track"] as const;

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) return <Outlet />;
  return <AppLayout />;
}

function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const logout = useLogout();

  useRealtimeInvalidations();

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (me.data?.user) setUser(me.data.user);
  }, [me.data, setUser]);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      clear();
      navigate({ to: "/login" });
    }
  }, [me.error, clear, navigate]);

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
  }, [user, navigate]);

  async function performLogout() {
    setLogoutOpen(false);
    await logout();
  }

  return (
    <div className="relative min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only fixed left-2 top-2 z-[60] rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft-lg focus:not-sr-only"
      >
        {t("a11y:skip_to_main")}
      </a>
      {/* Soft ambient gradient backdrop (subtle, only above the fold) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] opacity-40 dark:opacity-30"
        style={{
          background:
            "radial-gradient(800px 360px at 12% -10%, hsl(233 80% 65% / 0.18), transparent 60%), radial-gradient(700px 320px at 100% -20%, hsl(280 76% 60% / 0.14), transparent 60%)",
        }}
      />

      <header className="sticky top-0 z-40 glass-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {/* Brand */}
          <Link
            to="/"
            className="group flex items-center gap-2.5 font-bold tracking-tight"
            aria-label="Sadiya Kargo"
          >
            <BrandMark
              size={32}
              className="rounded-lg shadow-brand-glow transition-transform group-hover:scale-105"
            />
            <span className="hidden items-baseline gap-1.5 leading-none sm:flex">
              <span className="text-gradient-brand text-sm font-extrabold tracking-tight">
                Sadiya
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Kargo
              </span>
            </span>
          </Link>

          {/* Desktop nav inline */}
          {user && (
            <nav
              aria-label={t("nav:aria_main")}
              className="ml-2 hidden items-center gap-0.5 md:flex"
            >
              <TopNavLink to="/" icon={<BarChart3 className="h-4 w-4" />}>
                {t("nav:home")}
              </TopNavLink>
              <TopNavLink to="/depo" icon={<Warehouse className="h-4 w-4" />}>
                {t("nav:warehouse")}
              </TopNavLink>
              {user.role.permissions.includes("shipments:write") && (
                <TopNavLink to="/cikis" icon={<Truck className="h-4 w-4" />}>
                  {t("nav:ship")}
                </TopNavLink>
              )}
              <TopNavLink to="/takip" icon={<Package className="h-4 w-4" />}>
                {t("nav:track")}
              </TopNavLink>
              <TopNavLink to="/finans" icon={<Coins className="h-4 w-4" />}>
                {t("nav:finance")}
              </TopNavLink>
              <TopNavLink to="/raporlar" icon={<FileBarChart className="h-4 w-4" />}>
                {t("nav:reports")}
              </TopNavLink>

              {/* Drop-down with all admin-area screens; hidden when the user
                  doesn't have a single matching permission. */}
              <AdminMenu permissions={user.role.permissions} />
            </nav>
          )}

          {/* Right cluster: CommandPalette hidden on mobile (global ⌘K still
              works); LanguageSwitcher + ThemeToggle stay compact. Avatar always
              fits because every other control collapses or hides. */}
          <div className="ml-auto flex items-center gap-1.5">
            {user && (
              <div className="hidden md:block">
                <CommandPalette />
              </div>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
            {user && <UserMenu user={user} onLogout={() => setLogoutOpen(true)} />}
          </div>
        </div>
        <OfflineBanner />
      </header>

      {/* Subtle dot-grid background pattern — adds tactile feel without noise */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-14 -z-10 h-full opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "linear-gradient(to bottom, hsl(0 0% 100%) 0%, hsl(0 0% 100%) 60%, transparent 100%)",
        }}
      />

      <main id="main" className="relative z-10 mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 md:pb-8">
        <Breadcrumb className="mb-3" />
        {/* Keyed remount triggers fade-in-up on each route change */}
        <div key={pathname} className="animate-fade-in-up">
          <Outlet />
        </div>
      </main>

      <MobileBottomNav />
      <ScrollToTop />

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={t("auth:logoutAria")}
        description={t("auth:logoutConfirm")}
        confirmLabel={t("logout")}
        cancelLabel={t("cancel")}
        onConfirm={() => void performLogout()}
      />
    </div>
  );
}

function TopNavLink({
  to,
  children,
  icon,
}: {
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "[&.active]:bg-primary-soft [&.active]:text-primary-soft-foreground"
      )}
      activeOptions={{ exact: true }}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function AdminMenu({ permissions }: { permissions: string[] }) {
  const { t } = useTranslation();
  const has = (perm: string) => permissions.includes(perm);
  const canManageCounterparties = has("senders:write") || has("carriers:write");
  const canSeeAdminSection =
    has("users:manage") ||
    has("roles:manage") ||
    has("permissions:manage") ||
    has("audit:read") ||
    has("notifications:manage") ||
    has("exchange_rates:manage");
  if (!canManageCounterparties && !canSeeAdminSection) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "data-[state=open]:bg-muted data-[state=open]:text-foreground"
          )}
          aria-label={t("nav:manage")}
        >
          <LayoutGrid className="h-4 w-4" />
          <span>{t("nav:manage")}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("nav:manage")}</DropdownMenuLabel>
        {canManageCounterparties && (
          <>
            {has("senders:write") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/senders" className="cursor-pointer">
                  <UsersIcon className="h-4 w-4" /> {t("nav:senders")}
                </Link>
              </DropdownMenuItem>
            )}
            {has("carriers:write") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/carriers" className="cursor-pointer">
                  <Truck className="h-4 w-4" /> {t("nav:carriers")}
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        {canSeeAdminSection && (
          <>
            <DropdownMenuSeparator />
            {has("exchange_rates:manage") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/exchange-rates" className="cursor-pointer">
                  <Coins className="h-4 w-4" /> {t("nav:rates")}
                </Link>
              </DropdownMenuItem>
            )}
            {has("users:manage") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/users" className="cursor-pointer">
                  <ShieldCheck className="h-4 w-4" /> {t("nav:users")}
                </Link>
              </DropdownMenuItem>
            )}
            {has("roles:manage") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/access" className="cursor-pointer">
                  <ShieldCheck className="h-4 w-4" /> {t("nav:access")}
                </Link>
              </DropdownMenuItem>
            )}
            {has("notifications:manage") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/notifications" className="cursor-pointer">
                  <Bell className="h-4 w-4" /> {t("nav:notifications")}
                </Link>
              </DropdownMenuItem>
            )}
            {has("audit:read") && (
              <DropdownMenuItem asChild>
                <Link to="/admin/audit" className="cursor-pointer">
                  <ScrollText className="h-4 w-4" /> {t("nav:audit")}
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted data-[state=open]:bg-muted"
          aria-label={user.fullName}
        >
          <Avatar name={user.fullName} size="sm" />
          <span className="hidden text-xs font-semibold lg:inline">
            {user.fullName.split(" ")[0]}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={user.fullName} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {t("profile:info_role")}: <span className="font-semibold">{user.role.name}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <UserCircle className="h-4 w-4" /> {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onLogout();
          }}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" /> {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
