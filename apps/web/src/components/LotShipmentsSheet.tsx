import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Package, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { lotsApi } from "@/lib/api/lots";
import { carriersApi } from "@/lib/api/carriers";
import { formatDate } from "@/lib/format";

interface Props {
  lotId: string | null;
  /** Human-friendly label shown in the sheet title — "Sender — label" or fallback. */
  lotLabel?: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drill-down: every shipment that pulled stock from `lotId`. Opens as a
 * right-side sheet from the warehouse table so operators can answer
 * "when / to whom did this lot go out?" without leaving the page.
 */
export function LotShipmentsSheet({ lotId, lotLabel, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Jump to /takip and open the matching detail sheet via the URL `id`
  // param. Closes this sheet first so the takip route can take focus.
  const openInTakip = (shipmentId: string) => {
    onOpenChange(false);
    navigate({ to: "/takip", search: { id: shipmentId } });
  };

  const shipmentsQuery = useQuery({
    queryKey: ["lot-shipments", lotId],
    queryFn: () => lotsApi.shipments(lotId!),
    enabled: !!lotId,
  });

  // Carrier names resolved client-side from the cached catalogue.
  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: !!lotId,
  });
  const carrierName = (id: string): string => {
    const c = carriersQuery.data?.data.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : "—";
  };

  const rows = shipmentsQuery.data ?? [];
  const totalQty = rows.reduce((acc, r) => acc + r.qty, 0);

  return (
    <Sheet open={!!lotId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
        <div className="border-b bg-gradient-to-br from-primary-soft via-transparent to-transparent p-6">
          <SheetHeader>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("depo:shipments_title")}
            </p>
            <SheetTitle asChild>
              <h2 className="truncate text-xl font-bold tracking-tight">{lotLabel || "—"}</h2>
            </SheetTitle>
            {!shipmentsQuery.isLoading && rows.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("depo:shipments_summary", { count: rows.length, qty: totalQty })}
              </p>
            )}
          </SheetHeader>
        </div>

        <div className="p-4">
          {shipmentsQuery.isLoading && (
            <ul className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="space-y-2 rounded-lg border p-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </li>
              ))}
            </ul>
          )}

          {!shipmentsQuery.isLoading && rows.length === 0 && (
            <EmptyState
              icon={<Package />}
              title={t("depo:shipments_empty_title")}
              description={t("depo:shipments_empty_desc")}
            />
          )}

          {!shipmentsQuery.isLoading && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.shipmentId}>
                  <button
                    type="button"
                    onClick={() => openInTakip(r.shipmentId)}
                    aria-label={t("depo:shipments_open_aria", { code: r.shortCode })}
                    className="group w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.shortCode}
                          </span>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold">
                          {r.recipient?.name || "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Truck className="h-3 w-3 shrink-0" />
                          <span className="truncate">{carrierName(r.carrierId)}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(r.shipmentDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-lg font-bold tabular-nums">{r.qty}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("depo:col_qty")}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
