import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Coins,
  FileBarChart,
  LogOut,
  Menu,
  Package,
  ScrollText,
  ShieldCheck,
  Truck,
  Users as UsersIcon,
  UserCircle,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuthStore } from "@/stores/auth";
import { useLogout } from "@/lib/useLogout";
import { cn } from "@/lib/utils";

/**
 * Mobile-first bottom navigation (TZ §A): 5 most-used tabs + "Menü" drawer
 * for overflow. Hidden on md+ screens — desktop uses the top nav in __root.
 *
 * - Fixed bottom, height 64px + safe-area-inset-bottom for iPhone notch.
 * - Each tap target is 44×44px (TZ §A / WCAG 2.2 SC 2.5.8).
 * - Active state mirrors top-nav: `[&.active]` from TanStack Router.
 */
export function MobileBottomNav() {
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logout = useLogout();
  const { t } = useTranslation();
  if (!user) return null;

  const canMutate = user.role !== "viewer";
  const isAdmin = user.role === "admin";
  const close = () => setMenuOpen(false);

  return (
    <>
      <nav
        aria-label={t("nav:aria_mobile")}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:hidden"
      >
        <Item to="/" icon={<BarChart3 className="h-5 w-5" />} label={t("nav:homeShort")} />
        <Item to="/depo" icon={<Warehouse className="h-5 w-5" />} label={t("nav:warehouse")} />
        {canMutate ? (
          <Item to="/cikis" icon={<Truck className="h-5 w-5" />} label={t("nav:ship")} />
        ) : (
          <Item to="/takip" icon={<Package className="h-5 w-5" />} label={t("nav:track")} />
        )}
        <Item to="/finans" icon={<Coins className="h-5 w-5" />} label={t("nav:finance")} />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-14 min-w-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          aria-label={t("nav:menu")}
        >
          <Menu className="h-5 w-5" />
          <span>{t("nav:menu")}</span>
        </button>
      </nav>

      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav:all_pages")}
          className="fixed inset-0 z-50 flex md:hidden"
        >
          <div className="absolute inset-0 bg-black/55" onClick={close} aria-hidden="true" />
          <div className="ml-auto h-full w-72 max-w-[85vw] overflow-y-auto bg-background p-4 shadow-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("nav:all_pages")}
            </p>
            <ul className="space-y-1">
              {/* Overflow from the 5-tab bottom nav: track + reports always show. */}
              <DrawerLink to="/takip" onClose={close} icon={<Package />}>
                {t("nav:track")}
              </DrawerLink>
              <DrawerLink to="/raporlar" onClose={close} icon={<FileBarChart />}>
                {t("nav:reports")}
              </DrawerLink>

              {/* Operator+ section: counterparty management. */}
              {canMutate && (
                <>
                  <DrawerSectionLabel>{t("nav:manage")}</DrawerSectionLabel>
                  <DrawerLink to="/admin/senders" onClose={close} icon={<UsersIcon />}>
                    {t("nav:senders")}
                  </DrawerLink>
                  <DrawerLink to="/admin/carriers" onClose={close} icon={<Truck />}>
                    {t("nav:carriers")}
                  </DrawerLink>
                </>
              )}

              {/* Admin-only section: reference data + system. */}
              {isAdmin && (
                <>
                  <DrawerSectionLabel>{t("profile:info_role")}: admin</DrawerSectionLabel>
                  <DrawerLink to="/admin/exchange-rates" onClose={close} icon={<Coins />}>
                    {t("nav:rates")}
                  </DrawerLink>
                  <DrawerLink to="/admin/users" onClose={close} icon={<ShieldCheck />}>
                    {t("nav:users")}
                  </DrawerLink>
                  <DrawerLink to="/admin/notifications" onClose={close} icon={<Bell />}>
                    {t("nav:notifications")}
                  </DrawerLink>
                  <DrawerLink to="/admin/audit" onClose={close} icon={<ScrollText />}>
                    {t("nav:audit")}
                  </DrawerLink>
                </>
              )}

              <DrawerSectionLabel>{t("profile")}</DrawerSectionLabel>
              <DrawerLink to="/profile" onClose={close} icon={<UserCircle />}>
                {t("profile")}
              </DrawerLink>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setLogoutOpen(true);
                  }}
                  className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">
                    <LogOut />
                  </span>
                  {t("logout")}
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={t("auth:logoutAria")}
        description={t("auth:logoutConfirm")}
        confirmLabel={t("logout")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          setLogoutOpen(false);
          void logout();
        }}
      />
    </>
  );
}

function Item({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex h-14 min-w-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors",
        "hover:text-foreground",
        "[&.active]:text-primary"
      )}
      activeOptions={{ exact: true }}
    >
      {/* Pill behind icon — fades + scales in on active */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-3 top-1.5 h-8 rounded-2xl bg-primary-soft opacity-0 transition-all duration-300 ease-spring",
          "group-[&.active]:scale-100 group-[&.active]:opacity-100"
        )}
      />
      <span className="relative z-10 [&>svg]:transition-transform [&>svg]:duration-300 group-[&.active]:[&>svg]:scale-110">
        {icon}
      </span>
      <span className="relative z-10">{label}</span>
      {/* Top pill indicator */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 top-0 h-1 w-8 -translate-x-1/2 rounded-b-full bg-transparent transition-colors",
          "group-[&.active]:bg-primary"
        )}
      />
    </Link>
  );
}

function DrawerLink({
  to,
  icon,
  children,
  onClose,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <li>
      <Link
        to={to}
        onClick={onClose}
        className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-muted [&.active]:bg-primary/10 [&.active]:text-primary"
      >
        <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {children}
      </Link>
    </li>
  );
}

/** Small uppercase label that splits the drawer into logical sections. */
function DrawerSectionLabel({ children }: { children: ReactNode }) {
  return (
    <li
      role="presentation"
      className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
    >
      {children}
    </li>
  );
}
