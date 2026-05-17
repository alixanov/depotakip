import { ChevronRight, Home } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Auto-generated breadcrumb from the current pathname. Maps known
 * segments to localised labels via the `nav:*` namespace; falls back to
 * the raw segment for unknown ones.
 */
const SEGMENT_LABELS: Record<string, string> = {
  "": "nav:home",
  depo: "nav:warehouse",
  cikis: "nav:ship",
  takip: "nav:track",
  finans: "nav:finance",
  raporlar: "nav:reports",
  profile: "profile",
  admin: "nav:manage",
  senders: "nav:senders",
  carriers: "nav:carriers",
  categories: "nav:categories",
  "exchange-rates": "nav:rates",
  users: "nav:users",
  notifications: "nav:notifications",
  audit: "nav:audit",
};

export function Breadcrumb({ className }: { className?: string }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ? t(SEGMENT_LABELS[seg]) : seg,
    to: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-xs", className)}>
      <Link
        to="/"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((c) => (
        <span key={c.to} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          {c.last ? (
            <span className="rounded-md px-1.5 py-1 font-semibold text-foreground">{c.label}</span>
          ) : (
            <Link
              to={c.to}
              className="rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
