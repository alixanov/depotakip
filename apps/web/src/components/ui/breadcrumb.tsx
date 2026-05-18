import {
  Bell,
  ChevronRight,
  Coins,
  FileBarChart,
  Home,
  LayoutGrid,
  Package,
  ScrollText,
  ShieldCheck,
  Truck,
  Users as UsersIcon,
  UserCircle,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Auto-generated breadcrumb from the current pathname. Maps known segments
 * to a localised label + icon (mirroring the top-nav/mobile bottom-nav).
 * Unknown segments fall back to the raw string with no icon.
 */
interface SegmentMeta {
  label: string;
  Icon?: LucideIcon;
}

const SEGMENT_META: Record<string, SegmentMeta> = {
  depo: { label: "nav:warehouse", Icon: Warehouse },
  cikis: { label: "nav:ship", Icon: Truck },
  takip: { label: "nav:track", Icon: Package },
  finans: { label: "nav:finance", Icon: Coins },
  raporlar: { label: "nav:reports", Icon: FileBarChart },
  profile: { label: "profile", Icon: UserCircle },
  admin: { label: "nav:manage", Icon: LayoutGrid },
  senders: { label: "nav:senders", Icon: UsersIcon },
  carriers: { label: "nav:carriers", Icon: Truck },
  "exchange-rates": { label: "nav:rates", Icon: Coins },
  users: { label: "nav:users", Icon: ShieldCheck },
  notifications: { label: "nav:notifications", Icon: Bell },
  audit: { label: "nav:audit", Icon: ScrollText },
  access: { label: "nav:access", Icon: ShieldCheck },
};

export function Breadcrumb({ className }: { className?: string }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const meta = SEGMENT_META[seg];
    return {
      label: meta?.label ? t(meta.label) : seg,
      Icon: meta?.Icon,
      to: "/" + segments.slice(0, i + 1).join("/"),
      last: i === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-sm", className)}>
      <Link
        to="/"
        aria-label={t("nav:home")}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c) => (
        <span key={c.to} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          {c.last ? (
            <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold text-foreground">
              {c.Icon && <c.Icon className="h-3.5 w-3.5" />}
              {c.label}
            </span>
          ) : (
            <Link
              to={c.to}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {c.Icon && <c.Icon className="h-3.5 w-3.5" />}
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
