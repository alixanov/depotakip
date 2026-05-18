import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  BarChart3,
  Calendar,
  Coins,
  Package,
  Truck,
  Users as UsersIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { BrandTooltip } from "@/components/ui/chart-tooltip";
import { downloadReportExport, reportsApi, type ReportType } from "@/lib/api/reports";
import { requireAuth } from "@/lib/guards";
import { useFormatters, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "dashboard" | "carriers" | "senders" | "finance";

const TABS = ["dashboard", "carriers", "senders", "finance"] as const;

const raporSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/raporlar")({
  beforeLoad: requireAuth,
  validateSearch: (s) => raporSearchSchema.parse(s),
  component: ReportsPage,
});

const STATUS_COLORS: Record<string, string> = {
  bekliyor: "#94a3b8",
  yolda: "#f59e0b",
  teslim: "#10b981",
  kayip: "#ef4444",
  borclu: "#8b5cf6",
  iptal: "#9ca3af",
};

interface DateRange {
  from?: string;
  to?: string;
}

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "dashboard";
  const range: DateRange = { from: search.from, to: search.to };
  const { t } = useTranslation();

  const setTab = (next: string) =>
    navigate({
      search: (s) => ({ ...s, tab: next === "dashboard" ? undefined : (next as Tab) }),
    });
  const setRange = (next: DateRange) =>
    navigate({
      search: (s) => ({ ...s, from: next.from || undefined, to: next.to || undefined }),
    });

  const subtitleKey: Record<Tab, string> = {
    dashboard: "raporlar:subtitle_dashboard",
    carriers: "raporlar:subtitle_carriers",
    senders: "raporlar:subtitle_senders",
    finance: "raporlar:subtitle_finance",
  };

  const TabIcon: Record<Tab, typeof BarChart3> = {
    dashboard: BarChart3,
    carriers: Truck,
    senders: UsersIcon,
    finance: Coins,
  };

  const titleKey: Record<Tab, string> = {
    dashboard: "raporlar:tab_dashboard",
    carriers: "raporlar:tab_carriers",
    senders: "raporlar:tab_senders",
    finance: "raporlar:tab_finance",
  };

  const ActiveIcon = TabIcon[tab];

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <ActiveIcon className="h-4.5 w-4.5" />
            </span>
            {t(titleKey[tab])}
          </span>
        }
        subtitle={t(subtitleKey[tab])}
        actions={
          tab !== "dashboard" ? (
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
            </div>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="dashboard">
            <BarChart3 className="h-3.5 w-3.5" />
            {t("raporlar:tab_dashboard")}
          </TabsTrigger>
          <TabsTrigger value="carriers">
            <Truck className="h-3.5 w-3.5" />
            {t("raporlar:tab_carriers")}
          </TabsTrigger>
          <TabsTrigger value="senders">
            <UsersIcon className="h-3.5 w-3.5" />
            {t("raporlar:tab_senders")}
          </TabsTrigger>
          <TabsTrigger value="finance">
            <Coins className="h-3.5 w-3.5" />
            {t("raporlar:tab_finance")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <Dashboard range={range} />
        </TabsContent>
        <TabsContent value="carriers">
          <CarriersReport range={range} />
        </TabsContent>
        <TabsContent value="senders">
          <SendersReport range={range} />
        </TabsContent>
        <TabsContent value="finance">
          <FinanceReport range={range} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────────────────

function Dashboard({ range }: { range: DateRange }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["reports", "dashboard", range],
    queryFn: () => reportsApi.dashboard(range),
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (query.error) return <p className="text-destructive">{(query.error as Error).message}</p>;
  if (!query.data) return null;
  const data = query.data;

  const statusData = Object.entries(data.shipmentsByStatus).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("raporlar:kpi_shipments_total")} value={data.shipmentsTotal} />
        <Kpi label={t("raporlar:kpi_stock_total")} value={data.stockTotal} />
        <Kpi
          label={t("raporlar:kpi_carrier_balance")}
          value={formatUsdCents(data.carrierBalanceUsd)}
          tone={data.carrierBalanceUsd > 0 ? "amber" : "emerald"}
        />
        <Kpi
          label={t("raporlar:kpi_sender_balance")}
          value={formatUsdCents(data.senderBalanceUsd)}
          tone={data.senderBalanceUsd > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              {t("raporlar:card_status_dist")}
            </h3>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("raporlar:empty_shipments")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={88}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.name} fill={STATUS_COLORS[s.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<BrandTooltip />} cursor={{ fill: "transparent" }} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              {t("raporlar:card_daily_shipments")}
            </h3>
            {data.shipmentsByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("raporlar:empty_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.shipmentsByDay}>
                  <defs>
                    <linearGradient id="primaryFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 4"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="day"
                    fontSize={10}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={10}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <RechartsTooltip
                    content={<BrandTooltip />}
                    cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                  />
                  <Bar dataKey="count" fill="url(#primaryFill)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              {t("raporlar:card_daily_received")}
            </h3>
            {data.receivedByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("raporlar:empty_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.receivedByDay}>
                  <defs>
                    <linearGradient id="successFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 4"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="day"
                    fontSize={10}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={10}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <RechartsTooltip
                    content={<BrandTooltip />}
                    cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                  />
                  <Bar dataKey="qty" fill="url(#successFill)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "amber" | "emerald";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold tabular-nums",
            tone === "amber" && "text-amber-600",
            tone === "emerald" && "text-emerald-600"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared report utilities
// ────────────────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

function cycleSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> | null {
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}

function compare<T>(a: T, b: T): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function ExportButtons({
  type,
  range,
  disabled,
}: {
  type: ReportType;
  range: DateRange;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
        {t("raporlar:export_label")}:
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadReportExport(type, "csv", range)}
        disabled={disabled}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadReportExport(type, "xlsx", range)}
        disabled={disabled}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        XLSX
      </Button>
    </div>
  );
}

/**
 * Coloured pill for USD-cents balance — amber when counterparty owes us,
 * emerald when settled, info when we owe them (negative). Tone matches the
 * dashboard KPI colouring so operators learn one mapping.
 */
function BalanceCell({ usdCents }: { usdCents: number }) {
  const { t } = useTranslation();
  const tone = usdCents > 0 ? "owed" : usdCents < 0 ? "overpaid" : "settled";
  const cls =
    tone === "owed"
      ? "text-amber-700 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40"
      : tone === "overpaid"
        ? "text-violet-700 bg-violet-50 dark:text-violet-200 dark:bg-violet-950/40"
        : "text-emerald-700 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950/40";
  const label =
    tone === "owed"
      ? t("raporlar:balance_owed")
      : tone === "overpaid"
        ? t("raporlar:balance_we_owe")
        : t("raporlar:balance_settled");

  return (
    <Tooltip content={label}>
      <span
        className={cn(
          "inline-flex items-center justify-end rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
          cls
        )}
      >
        {formatUsdCents(usdCents)}
      </span>
    </Tooltip>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Carriers report
// ────────────────────────────────────────────────────────────────────────────

interface CarrierRow {
  carrierId: string;
  name: string;
  shipments: number;
  itemsTotal: number;
  chargesUsd: number;
  paymentsUsd: number;
  balanceUsd: number;
}

type CarrierSortKey = keyof Omit<CarrierRow, "carrierId">;

function CarriersReport({ range }: { range: DateRange }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["reports", "carriers", range],
    queryFn: () => reportsApi.report<CarrierRow>("carriers", range),
  });
  const [sort, setSort] = useState<SortState<CarrierSortKey> | null>({
    key: "balanceUsd",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const data = query.data ?? [];
    if (!sort) return data;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => factor * compare(a[sort.key], b[sort.key]));
  }, [query.data, sort]);

  const totals = useMemo(() => {
    return (query.data ?? []).reduce(
      (acc, r) => ({
        shipments: acc.shipments + r.shipments,
        itemsTotal: acc.itemsTotal + r.itemsTotal,
        chargesUsd: acc.chargesUsd + r.chargesUsd,
        paymentsUsd: acc.paymentsUsd + r.paymentsUsd,
        balanceUsd: acc.balanceUsd + r.balanceUsd,
      }),
      { shipments: 0, itemsTotal: 0, chargesUsd: 0, paymentsUsd: 0, balanceUsd: 0 }
    );
  }, [query.data]);

  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <p className="text-destructive">{(query.error as Error).message}</p>;
  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Truck />}
          title={t("raporlar:empty_table")}
          description={t("home:recent_empty_desc")}
        />
      </Card>
    );
  }

  const cols: SortableCol<CarrierSortKey>[] = [
    { key: "name", label: t("raporlar:col_carrier"), align: "left" },
    { key: "shipments", label: t("raporlar:col_shipments"), align: "right" },
    { key: "itemsTotal", label: t("raporlar:col_items"), align: "right" },
    { key: "chargesUsd", label: t("raporlar:col_charges"), align: "right" },
    { key: "paymentsUsd", label: t("raporlar:col_payments"), align: "right" },
    { key: "balanceUsd", label: t("raporlar:col_balance"), align: "right" },
  ];

  return (
    <div className="space-y-3">
      <ToolbarBar count={sorted.length} actions={<ExportButtons type="carriers" range={range} />} />

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {sorted.map((r) => (
          <Card key={r.carrierId} className="p-3">
            <div className="flex items-start gap-3">
              <Avatar name={r.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.shipments} · {r.itemsTotal} {t("raporlar:col_items").toLowerCase()}
                </p>
              </div>
              <BalanceCell usdCents={r.balanceUsd} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <span>
                {t("raporlar:col_charges")}:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatUsdCents(r.chargesUsd)}
                </span>
              </span>
              <span>
                {t("raporlar:col_payments")}:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatUsdCents(r.paymentsUsd)}
                </span>
              </span>
            </div>
          </Card>
        ))}
      </ul>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/85 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/65">
                <tr className="border-b">
                  {cols.map((c) => (
                    <SortableTh<CarrierSortKey>
                      key={c.key}
                      col={c}
                      sort={sort}
                      onChange={(next) => setSort(next)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.carrierId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} size="sm" />
                        <span className="truncate font-medium">{r.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.shipments}</td>
                    <td className="p-3 text-right tabular-nums">{r.itemsTotal}</td>
                    <td className="p-3 text-right tabular-nums">{formatUsdCents(r.chargesUsd)}</td>
                    <td className="p-3 text-right tabular-nums">{formatUsdCents(r.paymentsUsd)}</td>
                    <td className="p-3 text-right">
                      <BalanceCell usdCents={r.balanceUsd} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40 text-sm font-semibold">
                <tr>
                  <td className="p-3 uppercase tracking-wide text-[11px] text-muted-foreground">
                    {t("raporlar:totals_row")}
                  </td>
                  <td className="p-3 text-right tabular-nums">{totals.shipments}</td>
                  <td className="p-3 text-right tabular-nums">{totals.itemsTotal}</td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.chargesUsd)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.paymentsUsd)}
                  </td>
                  <td className="p-3 text-right">
                    <BalanceCell usdCents={totals.balanceUsd} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Senders report (mirror of carriers, but lots/qtyIn instead of shipments/items)
// ────────────────────────────────────────────────────────────────────────────

interface SenderRow {
  senderId: string;
  name: string;
  lots: number;
  qtyIn: number;
  chargesUsd: number;
  paymentsUsd: number;
  balanceUsd: number;
}

type SenderSortKey = keyof Omit<SenderRow, "senderId">;

function SendersReport({ range }: { range: DateRange }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["reports", "senders", range],
    queryFn: () => reportsApi.report<SenderRow>("senders", range),
  });
  const [sort, setSort] = useState<SortState<SenderSortKey> | null>({
    key: "balanceUsd",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const data = query.data ?? [];
    if (!sort) return data;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => factor * compare(a[sort.key], b[sort.key]));
  }, [query.data, sort]);

  const totals = useMemo(() => {
    return (query.data ?? []).reduce(
      (acc, r) => ({
        lots: acc.lots + r.lots,
        qtyIn: acc.qtyIn + r.qtyIn,
        chargesUsd: acc.chargesUsd + r.chargesUsd,
        paymentsUsd: acc.paymentsUsd + r.paymentsUsd,
        balanceUsd: acc.balanceUsd + r.balanceUsd,
      }),
      { lots: 0, qtyIn: 0, chargesUsd: 0, paymentsUsd: 0, balanceUsd: 0 }
    );
  }, [query.data]);

  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <p className="text-destructive">{(query.error as Error).message}</p>;
  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<UsersIcon />}
          title={t("raporlar:empty_table")}
          description={t("home:recent_empty_desc")}
        />
      </Card>
    );
  }

  const cols: SortableCol<SenderSortKey>[] = [
    { key: "name", label: t("raporlar:col_sender"), align: "left" },
    { key: "lots", label: t("raporlar:col_lots"), align: "right" },
    { key: "qtyIn", label: t("raporlar:col_qty_in"), align: "right" },
    { key: "chargesUsd", label: t("raporlar:col_charges"), align: "right" },
    { key: "paymentsUsd", label: t("raporlar:col_payments"), align: "right" },
    { key: "balanceUsd", label: t("raporlar:col_balance"), align: "right" },
  ];

  return (
    <div className="space-y-3">
      <ToolbarBar count={sorted.length} actions={<ExportButtons type="senders" range={range} />} />

      <ul className="space-y-2 md:hidden">
        {sorted.map((r) => (
          <Card key={r.senderId} className="p-3">
            <div className="flex items-start gap-3">
              <Avatar name={r.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.lots} {t("raporlar:col_lots").toLowerCase()} · {r.qtyIn}
                </p>
              </div>
              <BalanceCell usdCents={r.balanceUsd} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <span>
                {t("raporlar:col_charges")}:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatUsdCents(r.chargesUsd)}
                </span>
              </span>
              <span>
                {t("raporlar:col_payments")}:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatUsdCents(r.paymentsUsd)}
                </span>
              </span>
            </div>
          </Card>
        ))}
      </ul>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/85 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/65">
                <tr className="border-b">
                  {cols.map((c) => (
                    <SortableTh<SenderSortKey>
                      key={c.key}
                      col={c}
                      sort={sort}
                      onChange={(next) => setSort(next)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.senderId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} size="sm" />
                        <span className="truncate font-medium">{r.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.lots}</td>
                    <td className="p-3 text-right tabular-nums">{r.qtyIn}</td>
                    <td className="p-3 text-right tabular-nums">{formatUsdCents(r.chargesUsd)}</td>
                    <td className="p-3 text-right tabular-nums">{formatUsdCents(r.paymentsUsd)}</td>
                    <td className="p-3 text-right">
                      <BalanceCell usdCents={r.balanceUsd} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40 text-sm font-semibold">
                <tr>
                  <td className="p-3 uppercase tracking-wide text-[11px] text-muted-foreground">
                    {t("raporlar:totals_row")}
                  </td>
                  <td className="p-3 text-right tabular-nums">{totals.lots}</td>
                  <td className="p-3 text-right tabular-nums">{totals.qtyIn}</td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.chargesUsd)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.paymentsUsd)}
                  </td>
                  <td className="p-3 text-right">
                    <BalanceCell usdCents={totals.balanceUsd} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Finance daily report
// ────────────────────────────────────────────────────────────────────────────

interface FinanceRow {
  date: string;
  carrierChargesUsd: number;
  carrierPaymentsUsd: number;
  senderChargesUsd: number;
  senderPaymentsUsd: number;
}

type FinanceSortKey = keyof FinanceRow;

function FinanceReport({ range }: { range: DateRange }) {
  const { t } = useTranslation();
  const { formatDate } = useFormatters();
  const query = useQuery({
    queryKey: ["reports", "finance", range],
    queryFn: () => reportsApi.report<FinanceRow>("finance", range),
  });
  const [sort, setSort] = useState<SortState<FinanceSortKey> | null>({ key: "date", dir: "desc" });

  const sorted = useMemo(() => {
    const data = query.data ?? [];
    if (!sort) return data;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => factor * compare(a[sort.key], b[sort.key]));
  }, [query.data, sort]);

  const totals = useMemo(() => {
    return (query.data ?? []).reduce(
      (acc, r) => ({
        carrierChargesUsd: acc.carrierChargesUsd + r.carrierChargesUsd,
        carrierPaymentsUsd: acc.carrierPaymentsUsd + r.carrierPaymentsUsd,
        senderChargesUsd: acc.senderChargesUsd + r.senderChargesUsd,
        senderPaymentsUsd: acc.senderPaymentsUsd + r.senderPaymentsUsd,
      }),
      {
        carrierChargesUsd: 0,
        carrierPaymentsUsd: 0,
        senderChargesUsd: 0,
        senderPaymentsUsd: 0,
      }
    );
  }, [query.data]);

  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <p className="text-destructive">{(query.error as Error).message}</p>;
  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Coins />}
          title={t("raporlar:empty_table")}
          description={t("home:recent_empty_desc")}
        />
      </Card>
    );
  }

  const cols: SortableCol<FinanceSortKey>[] = [
    { key: "date", label: t("raporlar:col_date"), align: "left" },
    { key: "carrierChargesUsd", label: t("raporlar:col_carrier_charges"), align: "right" },
    { key: "carrierPaymentsUsd", label: t("raporlar:col_carrier_payments"), align: "right" },
    { key: "senderChargesUsd", label: t("raporlar:col_sender_charges"), align: "right" },
    { key: "senderPaymentsUsd", label: t("raporlar:col_sender_payments"), align: "right" },
  ];

  return (
    <div className="space-y-3">
      <ToolbarBar count={sorted.length} actions={<ExportButtons type="finance" range={range} />} />

      <ul className="space-y-2 md:hidden">
        {sorted.map((r) => (
          <Card key={r.date} className="p-3">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{formatDate(r.date)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{t("raporlar:col_carrier_charges")}</span>
              <span className="text-right font-semibold text-foreground tabular-nums">
                {formatUsdCents(r.carrierChargesUsd)}
              </span>
              <span>{t("raporlar:col_carrier_payments")}</span>
              <span className="text-right font-semibold text-foreground tabular-nums">
                {formatUsdCents(r.carrierPaymentsUsd)}
              </span>
              <span>{t("raporlar:col_sender_charges")}</span>
              <span className="text-right font-semibold text-foreground tabular-nums">
                {formatUsdCents(r.senderChargesUsd)}
              </span>
              <span>{t("raporlar:col_sender_payments")}</span>
              <span className="text-right font-semibold text-foreground tabular-nums">
                {formatUsdCents(r.senderPaymentsUsd)}
              </span>
            </div>
          </Card>
        ))}
      </ul>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/85 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/65">
                <tr className="border-b">
                  {cols.map((c) => (
                    <SortableTh<FinanceSortKey>
                      key={c.key}
                      col={c}
                      sort={sort}
                      onChange={(next) => setSort(next)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.date} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(r.date)}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatUsdCents(r.carrierChargesUsd)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatUsdCents(r.carrierPaymentsUsd)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatUsdCents(r.senderChargesUsd)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatUsdCents(r.senderPaymentsUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40 text-sm font-semibold">
                <tr>
                  <td className="p-3 uppercase tracking-wide text-[11px] text-muted-foreground">
                    {t("raporlar:totals_row")}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.carrierChargesUsd)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.carrierPaymentsUsd)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.senderChargesUsd)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatUsdCents(totals.senderPaymentsUsd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

interface SortableCol<K extends string> {
  key: K;
  label: string;
  align: "left" | "right";
}

function SortableTh<K extends string>({
  col,
  sort,
  onChange,
}: {
  col: SortableCol<K>;
  sort: SortState<K> | null;
  onChange: (next: SortState<K> | null) => void;
}) {
  const active = sort?.key === col.key;
  const ariaSort = !active ? "none" : sort?.dir === "asc" ? "ascending" : "descending";
  return (
    <th
      className={cn("p-3", col.align === "right" && "text-right")}
      aria-sort={ariaSort as React.AriaAttributes["aria-sort"]}
    >
      <button
        type="button"
        onClick={() => onChange(cycleSort(sort, col.key))}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {col.label}
        <span aria-hidden="true" className="text-xs leading-none">
          {active ? (sort?.dir === "asc" ? "↑" : "↓") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function ToolbarBar({ count, actions }: { count: number; actions: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Badge tone="primary" size="lg">
        <Package className="h-3 w-3" />
        {t("raporlar:rows_count", { n: count })}
      </Badge>
      {actions}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-44" />
      <Card>
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
