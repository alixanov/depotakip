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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { downloadReportExport, reportsApi, type ReportType } from "@/lib/api/reports";
import { requireAuth } from "@/lib/guards";
import { cn } from "@/lib/utils";
import { formatUsdCents } from "@/lib/format";
import { BrandTooltip } from "@/components/ui/chart-tooltip";

/**
 * Report rows arrive as raw objects. We give each ReportType an explicit
 * column definition so headers are localised and money cells are formatted
 * (not "12345" USD-cents).
 */
const USD_KEYS = new Set([
  "chargesUsd",
  "paymentsUsd",
  "balanceUsd",
  "carrierChargesUsd",
  "carrierPaymentsUsd",
  "senderChargesUsd",
  "senderPaymentsUsd",
]);

const REPORT_COLUMN_DEFS: Record<ReportType, { key: string; header: string }[]> = {
  carriers: [
    { key: "name", header: "Kargocu" },
    { key: "shipments", header: "Gönderi" },
    { key: "itemsTotal", header: "Adet" },
    { key: "chargesUsd", header: "Borç" },
    { key: "paymentsUsd", header: "Ödeme" },
    { key: "balanceUsd", header: "Bakiye" },
  ],
  senders: [
    { key: "name", header: "Gönderici" },
    { key: "lots", header: "Parti" },
    { key: "qtyIn", header: "Adet" },
    { key: "chargesUsd", header: "Borç" },
    { key: "paymentsUsd", header: "Ödeme" },
    { key: "balanceUsd", header: "Bakiye" },
  ],
  categories: [
    { key: "name", header: "Kategori" },
    { key: "lots", header: "Parti" },
    { key: "qtyIn", header: "Geldi" },
    { key: "qtyAvailable", header: "Stoğa" },
  ],
  finance: [
    { key: "date", header: "Tarih" },
    { key: "carrierChargesUsd", header: "Kargocu borç" },
    { key: "carrierPaymentsUsd", header: "Kargocu ödeme" },
    { key: "senderChargesUsd", header: "Gönderici borç" },
    { key: "senderPaymentsUsd", header: "Gönderici ödeme" },
  ],
};

type Tab = "dashboard" | "carriers" | "senders" | "categories" | "finance";

const raporSearchSchema = z.object({
  tab: z
    .enum(["dashboard", "carriers", "senders", "categories", "finance"])
    .optional()
    .catch(undefined),
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

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "dashboard";
  const setTab = (next: string) =>
    navigate({ search: { tab: next === "dashboard" ? undefined : (next as Tab) } });
  const { t } = useTranslation();

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      {/* Horizontal scroll instead of flex-wrap — 5 Turkish labels at 375px
          mobile previously broke into 2 rows and looked broken. */}
      <TabsList className="w-full overflow-x-auto">
        <TabsTrigger value="dashboard">{t("raporlar:tab_dashboard")}</TabsTrigger>
        <TabsTrigger value="carriers">{t("raporlar:tab_carriers")}</TabsTrigger>
        <TabsTrigger value="senders">{t("raporlar:tab_senders")}</TabsTrigger>
        <TabsTrigger value="categories">{t("raporlar:tab_categories")}</TabsTrigger>
        <TabsTrigger value="finance">{t("raporlar:tab_finance")}</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        <Dashboard />
      </TabsContent>
      <TabsContent value="carriers">
        <TabularReport type="carriers" />
      </TabsContent>
      <TabsContent value="senders">
        <TabularReport type="senders" />
      </TabsContent>
      <TabsContent value="categories">
        <TabularReport type="categories" />
      </TabsContent>
      <TabsContent value="finance">
        <TabularReport type="finance" />
      </TabsContent>
    </Tabs>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: () => reportsApi.dashboard(),
  });

  if (query.isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
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
                  <Tooltip content={<BrandTooltip />} cursor={{ fill: "transparent" }} />
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
                  <Tooltip
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
                  <Tooltip
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

function TabularReport({ type }: { type: ReportType }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["reports", type],
    queryFn: () => reportsApi.report<Record<string, unknown>>(type),
  });

  const columns: Column<Record<string, unknown>>[] = REPORT_COLUMN_DEFS[type].map((def) => ({
    key: def.key,
    header: def.header,
    cell: (row) => {
      const raw = row[def.key];
      if (raw == null) return "—";
      if (USD_KEYS.has(def.key) && typeof raw === "number") return formatUsdCents(raw);
      return String(raw);
    },
    className: USD_KEYS.has(def.key) ? "tabular-nums text-right" : undefined,
  }));

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadReportExport(type, "csv")}>
          <Download className="mr-1 h-4 w-4" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadReportExport(type, "xlsx")}>
          <Download className="mr-1 h-4 w-4" />
          XLSX
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(r) => String((r.carrierId || r.senderId || r.categoryId || r.date) as string)}
            empty={t("raporlar:empty_table")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
