import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { STATUSES, type Shipment, type Status } from "@sadiyakargo/shared";
import { AlertTriangle, Download, Package, Truck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips, type FilterChip } from "@/components/ui/filter-chips";
import {
  DataTable,
  PaginationBar,
  sortToParam,
  type Column,
  type SortState,
} from "@/components/ui/data-table";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useTranslation } from "react-i18next";
import { downloadWaybillPdf, shipmentsApi } from "@/lib/api/shipments";
import { carriersApi } from "@/lib/api/carriers";
import { requireAuth } from "@/lib/guards";
import { useCan } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/status-pill";
import { ShipmentDetailSheet } from "@/components/ShipmentDetailSheet";
import { ShipmentStatusChanger } from "@/components/ShipmentStatusChanger";
import { RowActions } from "@/components/ui/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRealtimeStore } from "@/stores/realtime";

/** Persistable URL state. Survives reload, browser back/forward, deep links.
 *  `id` is accepted (so legacy `/takip?id=…` links still work), but it's now
 *  consumed as a one-shot trigger that opens the detail Sheet and then drops
 *  itself from the URL — see `useEffect` below. Persisting the open Sheet in
 *  the URL caused refreshes to land users on a near-full-screen panel with
 *  the underlying table hidden behind a backdrop, which read as "Tracking
 *  page is broken". */
const searchSchema = z.object({
  id: z.string().optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  /** "Dikkat" smart preset — overrides `status` (server-side) when truthy. */
  attention: z.coerce.boolean().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  sortKey: z.enum(["shipmentDate", "shortCode"]).optional().catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

/** Mirrors backend cutoff: bekliyor older than 3 days is overdue. */
const OVERDUE_DAYS = 3;
const OVERDUE_MS = OVERDUE_DAYS * 24 * 60 * 60 * 1000;
function isOverdueBekliyor(s: Shipment): boolean {
  return s.status === "bekliyor" && Date.now() - new Date(s.shipmentDate).getTime() > OVERDUE_MS;
}
function isAttention(s: Shipment): boolean {
  return s.status === "borclu" || s.status === "kayip" || isOverdueBekliyor(s);
}

export const Route = createFileRoute("/takip")({
  beforeLoad: requireAuth,
  validateSearch: (s) => searchSchema.parse(s),
  component: TakipPage,
});

function TakipPage() {
  const canMutate = useCan("shipments:write");
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const statusFilter: Status | "" = search.status ?? "";
  const attention = search.attention ?? false;
  const sort: SortState | undefined = search.sortKey
    ? { key: search.sortKey, dir: search.sortDir ?? "desc" }
    : undefined;

  const setPage = (p: number) => navigate({ search: (s) => ({ ...s, page: p }) });
  // Choosing a status clears `attention`; choosing attention clears status. They are exclusive.
  const setStatusFilter = (status: Status | "") =>
    navigate({
      search: (s) => ({ ...s, page: 1, status: status || undefined, attention: undefined }),
    });
  const toggleAttention = () =>
    navigate({
      search: (s) => ({
        ...s,
        page: 1,
        status: undefined,
        attention: attention ? undefined : true,
      }),
    });
  const setSort = (next: SortState | undefined) =>
    navigate({
      search: (s) => ({
        ...s,
        sortKey: next?.key as "shipmentDate" | "shortCode" | undefined,
        sortDir: next?.dir,
      }),
    });

  const [editing, setEditing] = useState<Shipment | null>(null);
  // Detail Sheet uses local state instead of URL persistence. We still accept
  // `?id=…` for deep links (LotShipmentsSheet → /takip?id=…), but consume it
  // once on mount so a refresh doesn't re-open the Sheet on top of the table.
  const [detailId, setDetailId] = useState<string | null>(() => search.id ?? null);
  useEffect(() => {
    if (search.id) {
      navigate({ search: (s) => ({ ...s, id: undefined }), replace: true });
    }
    // Run once on mount; subsequent URL changes don't auto-open the Sheet.
  }, [search.id, navigate]);
  const { t } = useTranslation();
  // Subscribe to flashedAt so rows re-render when a socket event lands and
  // again when the flash TTL expires.
  const flashedAt = useRealtimeStore((s) => s.flashedAt);

  const query = useQuery({
    queryKey: ["shipments", { page, statusFilter, attention, sort }],
    queryFn: () =>
      shipmentsApi.list({
        page,
        limit: 20,
        status: attention ? undefined : statusFilter || undefined,
        attention: attention || undefined,
        sort: sortToParam(sort),
      }),
  });

  // Carriers index for the table's "Перевозчик" column. Cached separately so
  // the shipments query doesn't refetch when the carrier list changes.
  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const carrierName = (id: string): string => {
    const c = carriersQuery.data?.data.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}`.trim() : "—";
  };

  const columns: Column<Shipment>[] = [
    {
      key: "code",
      header: t("takip:col_no"),
      cell: (s) => <span className="font-mono text-xs">{s.shortCode}</span>,
      width: "130px",
      sortKey: "shortCode",
    },
    {
      key: "date",
      header: t("date"),
      cell: (s) => formatDate(s.shipmentDate),
      width: "100px",
      sortKey: "shipmentDate",
    },
    {
      key: "age",
      header: t("takip:col_age"),
      width: "100px",
      cell: (s) => (
        <span
          className={cn(
            "text-xs",
            isOverdueBekliyor(s)
              ? "font-semibold text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {formatRelativeTime(s.shipmentDate)}
        </span>
      ),
    },
    {
      key: "recipient",
      header: t("takip:col_recipient"),
      cell: (s) => s.recipient?.name || "—",
    },
    {
      key: "carrier",
      header: t("takip:col_carrier"),
      cell: (s) => <span className="truncate">{carrierName(s.carrierId)}</span>,
      width: "160px",
    },
    {
      key: "items",
      header: t("takip:col_qty"),
      cell: (s) => s.items.reduce((acc, it) => acc + it.qty, 0),
      width: "80px",
    },
    {
      key: "status",
      header: t("status"),
      cell: (s) => <StatusPill status={s.status} />,
      width: "120px",
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      className: "text-right",
      cell: (s) => (
        <RowActions label={t("actions")}>
          <DropdownMenuItem
            onClick={() => {
              downloadWaybillPdf(s.id, s.shortCode);
            }}
          >
            <Download className="h-4 w-4" />
            {t("takip:waybill_aria")}
          </DropdownMenuItem>
          {canMutate && (
            <DropdownMenuItem onClick={() => setEditing(s)}>
              <Truck className="h-4 w-4" />
              {t("takip:btn_status")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() =>
              window.open(`/track/${s.publicTrackingToken}`, "_blank", "noopener,noreferrer")
            }
          >
            <Package className="h-4 w-4" />
            {t("nav:track")}
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const activeChips: FilterChip[] = [];
  if (attention) {
    activeChips.push({
      key: "attention",
      label: (
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {t("takip:attention")}
        </span>
      ),
      onClear: () => toggleAttention(),
    });
  }
  if (statusFilter) {
    activeChips.push({
      key: `status:${statusFilter}`,
      label: (
        <>
          {t("status")}: <span className="font-semibold">{t(`status:${statusFilter}`)}</span>
        </>
      ),
      onClear: () => setStatusFilter(""),
    });
  }
  if (sort) {
    activeChips.push({
      key: `sort:${sort.key}:${sort.dir}`,
      label: (
        <>
          {sort.dir === "desc" ? "↓" : "↑"}{" "}
          <span className="font-semibold">
            {sort.key === "shipmentDate" ? t("date") : t("takip:col_no")}
          </span>
        </>
      ),
      onClear: () => setSort(undefined),
    });
  }

  // Filter chip-bar: smart "Dikkat" preset + every status, mutually exclusive.
  const statusOptions: {
    value: Status | "" | "attention";
    label: string;
    icon?: React.ReactNode;
  }[] = [
    { value: "", label: t("takip:filter_all_status") },
    {
      value: "attention",
      label: t("takip:attention"),
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    ...STATUSES.map((s) => ({ value: s, label: t(`status:${s}`) })),
  ];
  const currentChip: (typeof statusOptions)[number]["value"] = attention
    ? "attention"
    : statusFilter || "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t("status")}>
        {statusOptions.map((opt) => {
          const active = currentChip === opt.value;
          const isAttn = opt.value === "attention";
          return (
            <button
              key={opt.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (isAttn) toggleAttention();
                else setStatusFilter(opt.value as Status | "");
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                active
                  ? isAttn
                    ? "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                    : "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>

      <FilterChips
        chips={activeChips}
        onClearAll={() => {
          setStatusFilter("");
          if (attention) toggleAttention();
          setSort(undefined);
        }}
      />

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data?.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(s) => s.id}
            rowClassName={(s) =>
              cn(
                isAttention(s) &&
                  "bg-amber-50/50 dark:bg-amber-950/15 border-l-2 border-l-amber-500",
                flashedAt[s.id] && "animate-row-flash"
              )
            }
            empty={
              <EmptyState
                icon={<Package />}
                title={t("takip:empty")}
                description={t("home:recent_empty_desc")}
                action={
                  canMutate ? (
                    <Link to="/cikis">
                      <Button variant="brand" size="sm">
                        <Truck className="h-3.5 w-3.5" />
                        {t("cikis:title")}
                      </Button>
                    </Link>
                  ) : null
                }
              />
            }
            sort={sort}
            onSortChange={setSort}
            onRowClick={(s) => setDetailId(s.id)}
            renderCard={(s) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{s.shortCode}</span>
                    <StatusPill status={s.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">{s.recipient?.name || "—"}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Truck className="h-3 w-3 shrink-0" />
                    <span className="truncate">{carrierName(s.carrierId)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(s.shipmentDate)} · {s.items.reduce((acc, it) => acc + it.qty, 0)}{" "}
                    {t("takip:col_qty")}
                  </p>
                </div>
                <RowActions label={t("actions")}>
                  {canMutate && (
                    <DropdownMenuItem onClick={() => setEditing(s)}>
                      <Truck className="h-4 w-4" />
                      {t("takip:btn_status")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => downloadWaybillPdf(s.id, s.shortCode)}>
                    <Download className="h-4 w-4" />
                    {t("takip:waybill_aria")}
                  </DropdownMenuItem>
                </RowActions>
              </div>
            )}
          />
          <PaginationBar pagination={query.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>

      {editing && (
        <StatusDialog shipment={editing} open={!!editing} onClose={() => setEditing(null)} />
      )}

      <ShipmentDetailSheet
        shipmentId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        canMutate={canMutate}
      />
    </div>
  );
}

function StatusDialog({
  shipment,
  open,
  onClose,
}: {
  shipment: Shipment;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t("takip:dialog_title", { code: shipment.shortCode })}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ShipmentStatusChanger
          shipment={shipment}
          onComplete={onClose}
          onCancel={onClose}
          variant="dialog"
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
