import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Coins,
  FileBarChart,
  Package,
  Truck,
  Users as UsersIcon,
  Warehouse,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { reportsApi } from "@/lib/api/reports";
import { shipmentsApi } from "@/lib/api/shipments";
import { requireAuth } from "@/lib/guards";
import { useAuthStore, useCanAny } from "@/stores/auth";
import { formatDate, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Shipment, Status } from "@sadiyakargo/shared";

export const Route = createFileRoute("/")({
  beforeLoad: requireAuth,
  component: HomePage,
});

function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  // `canMutate` gates the home page's primary-action shortcuts ("Depo" + "Çıkış").
  // True for anyone who can either intake stock or create a shipment.
  const canMutate = useCanAny("lots:write", "shipments:write");

  const dashboard = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: () => reportsApi.dashboard(),
  });
  const recent = useQuery({
    queryKey: ["shipments", "recent"],
    queryFn: () => shipmentsApi.list({ page: 1, limit: 5, sort: "-shipmentDate" }),
  });

  const greeting = computeGreeting();
  const firstName = user?.fullName?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t(`home:greeting_${greeting}`)}
        title={
          firstName ? (
            <>
              <span className="text-gradient-brand">{firstName}</span>
              <span className="text-foreground">,</span>{" "}
              <span className="font-bold">{t("home:title")}</span>
            </>
          ) : (
            t("home:title")
          )
        }
        subtitle={t("home:subtitle")}
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              <Link to="/depo">
                <Button variant="outline">
                  <Boxes className="h-4 w-4" />
                  {t("depo:tabs_receive")}
                </Button>
              </Link>
              <Link to="/cikis">
                <Button variant="brand">
                  <Truck className="h-4 w-4" />
                  {t("nav:ship")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : null
        }
      />

      {/* KPI grid */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("raporlar:kpi_shipments_total")}
          value={dashboard.data?.shipmentsTotal ?? 0}
          icon={<Package className="h-4 w-4" />}
          loading={dashboard.isLoading}
          to="/takip"
          trend={dashboard.data?.shipmentsByDay.map((d) => d.count).slice(-7)}
        />
        <KpiCard
          label={t("raporlar:kpi_stock_total")}
          value={dashboard.data?.stockTotal ?? 0}
          icon={<Warehouse className="h-4 w-4" />}
          loading={dashboard.isLoading}
          to="/depo"
          trend={dashboard.data?.receivedByDay.map((d) => d.qty).slice(-7)}
          trendTone="success"
        />
        <KpiCard
          label={t("raporlar:kpi_carrier_balance")}
          value={dashboard.data?.carrierBalanceUsd ?? 0}
          format={(n) => formatUsdCents(Math.round(n))}
          tone={dashboard.data && dashboard.data.carrierBalanceUsd > 0 ? "warning" : "success"}
          icon={<Truck className="h-4 w-4" />}
          loading={dashboard.isLoading}
          to="/finans"
        />
        <KpiCard
          label={t("raporlar:kpi_sender_balance")}
          value={dashboard.data?.senderBalanceUsd ?? 0}
          format={(n) => formatUsdCents(Math.round(n))}
          tone={dashboard.data && dashboard.data.senderBalanceUsd > 0 ? "warning" : "success"}
          icon={<UsersIcon className="h-4 w-4" />}
          loading={dashboard.isLoading}
          to="/finans"
        />
      </section>

      {/* Recent shipments + status breakdown */}
      <section className="grid gap-4 lg:grid-cols-3">
        <RecentShipmentsCard loading={recent.isLoading} shipments={recent.data?.data ?? []} />
        <StatusBreakdownCard
          loading={dashboard.isLoading}
          byStatus={dashboard.data?.shipmentsByStatus ?? {}}
        />
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  format,
  icon,
  tone,
  loading,
  to,
  trend,
  trendTone,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: React.ReactNode;
  tone?: "success" | "warning";
  loading?: boolean;
  to?: string;
  trend?: number[];
  trendTone?: "primary" | "success" | "warning" | "danger";
}) {
  const inner = (
    <Card interactive={!!to} className="group relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground transition-colors group-hover:bg-primary/15">
            {icon}
          </span>
          {to && (
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              tone === "warning" && "text-amber-600 dark:text-amber-400",
              tone === "success" && "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <AnimatedNumber value={value} format={format} />
            )}
          </div>
          {trend && trend.length >= 2 && (
            <Sparkline
              data={trend}
              tone={trendTone ?? "primary"}
              width={70}
              height={24}
              className="opacity-80 transition-opacity group-hover:opacity-100"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function RecentShipmentsCard({ loading, shipments }: { loading: boolean; shipments: Shipment[] }) {
  const { t } = useTranslation();
  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center justify-between p-5">
        <div>
          <h3 className="text-sm font-semibold">{t("home:recent_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("home:recent_subtitle")}</p>
        </div>
        <Link to="/takip">
          <Button variant="ghost" size="sm">
            <FileBarChart className="h-3.5 w-3.5" />
            {t("home:see_all")}
          </Button>
        </Link>
      </div>
      <div className="border-t">
        {loading && (
          <ul className="divide-y">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </li>
            ))}
          </ul>
        )}
        {!loading && shipments.length === 0 && (
          <EmptyState
            icon={<Package />}
            title={t("takip:empty")}
            description={t("home:recent_empty_desc")}
            action={
              <Link to="/cikis">
                <Button variant="brand" size="sm">
                  <Truck className="h-3.5 w-3.5" />
                  {t("cikis:title")}
                </Button>
              </Link>
            }
          />
        )}
        {!loading && shipments.length > 0 && (
          <ul className="divide-y">
            {shipments.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
              >
                <Avatar name={s.recipient?.name || s.shortCode} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.recipient?.name || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{s.shortCode}</span>
                    <span className="mx-1.5">·</span>
                    {formatDate(s.shipmentDate)}
                    <span className="mx-1.5">·</span>
                    {s.items.reduce((acc, it) => acc + it.qty, 0)} {t("takip:col_qty")}
                  </p>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function StatusBreakdownCard({
  loading,
  byStatus,
}: {
  loading: boolean;
  byStatus: Record<string, number>;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(byStatus).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((acc, [, n]) => acc + n, 0);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("raporlar:card_status_dist")}</h3>
          <Badge tone="primary">{total}</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {loading &&
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          {!loading && entries.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t("raporlar:empty_shipments")}
            </p>
          )}
          {!loading &&
            entries.map(([key, count]) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <StatusPill status={key as Status} />
                    <span className="font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
        <Link to="/raporlar" className="mt-4 block">
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" />
              {t("nav:reports")}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function computeGreeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
