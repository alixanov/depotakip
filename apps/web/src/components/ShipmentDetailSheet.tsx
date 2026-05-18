import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Coins,
  Download,
  ExternalLink,
  MessageSquare,
  Package,
  Truck,
  User,
} from "lucide-react";
import type { Status } from "@sadiyakargo/shared";
import { STATUS_TONE } from "@sadiyakargo/shared";
import { ShipmentStatusChanger } from "./ShipmentStatusChanger";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { shipmentsApi, downloadWaybillPdf } from "@/lib/api/shipments";
import { lotsApi } from "@/lib/api/lots";
import { carriersApi } from "@/lib/api/carriers";
import { sendersApi } from "@/lib/api/senders";
import { formatDate, formatDateTime, formatMoney, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ShipmentDetailSheetProps {
  shipmentId: string | null;
  onOpenChange: (open: boolean) => void;
  canMutate?: boolean;
}

/**
 * Slide-in detail panel — opens when user clicks a row in the takip table.
 * Shows everything about the shipment without navigating away: carrier,
 * recipient, items breakdown, status timeline, and quick actions.
 *
 * On mobile, slides up from the bottom; on desktop, from the right.
 */
export function ShipmentDetailSheet({
  shipmentId,
  onOpenChange,
  canMutate,
}: ShipmentDetailSheetProps) {
  const { t } = useTranslation();
  // Toggles the inline status chooser inside the sheet. Avoids the
  // open-sheet → close → open-dialog round-trip.
  const [statusEditing, setStatusEditing] = useState(false);

  // Detail query — only enabled when we have an id
  const detail = useQuery({
    queryKey: ["shipment", shipmentId],
    queryFn: () => shipmentsApi.get(shipmentId!),
    enabled: !!shipmentId,
  });

  const lotsQuery = useQuery({
    queryKey: ["lots", "all"],
    queryFn: () => lotsApi.list({ limit: 200 }),
    enabled: !!shipmentId,
  });

  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 200 }),
    enabled: !!shipmentId,
  });

  // Senders are used to resolve `lot.senderId` → display name in the items
  // list. We keep a single broad query here (cached across all detail sheets)
  // rather than fetching per-lot, because the senders set is small.
  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
    enabled: !!shipmentId,
  });

  const carrier = detail.data
    ? carriersQuery.data?.data.find((c) => c.id === detail.data!.carrierId)
    : undefined;

  return (
    <Sheet open={!!shipmentId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
        {detail.isLoading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {detail.data && (
          <>
            {/* Hero */}
            <div className="border-b bg-gradient-to-br from-primary-soft via-transparent to-transparent p-6">
              <SheetHeader>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {detail.data.shortCode}
                </p>
                <SheetTitle asChild>
                  <h2 className="text-2xl font-bold tracking-tight">
                    {detail.data.recipient?.name || t("track:recipient")}
                  </h2>
                </SheetTitle>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill status={detail.data.status} full />
                  <span className="text-xs text-muted-foreground">
                    · {formatRelativeTime(detail.data.updatedAt)}
                  </span>
                </div>
              </SheetHeader>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 border-b bg-muted/30 px-6 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadWaybillPdf(detail.data!.id, detail.data!.shortCode)}
              >
                <Download className="h-3.5 w-3.5" />
                {t("takip:waybill_aria")}
              </Button>
              {canMutate && !statusEditing && (
                <Button variant="brand" size="sm" onClick={() => setStatusEditing(true)}>
                  <Truck className="h-3.5 w-3.5" />
                  {t("takip:btn_status")}
                </Button>
              )}
              <a
                href={`/track/${detail.data.publicTrackingToken}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto"
              >
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("nav:track")}
                </Button>
              </a>
            </div>

            {/* Inline status chooser — replaces the modal round-trip. */}
            {canMutate && statusEditing && (
              <div className="border-b px-6 py-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("takip:dialog_title", { code: detail.data.shortCode })}
                </h3>
                <ShipmentStatusChanger
                  shipment={detail.data}
                  onComplete={() => setStatusEditing(false)}
                  onCancel={() => setStatusEditing(false)}
                />
              </div>
            )}

            {/* Meta grid */}
            <div className="grid border-b sm:grid-cols-2">
              <MetaRow
                icon={<CalendarDays className="h-4 w-4" />}
                label={t("track:shipmentDate")}
                value={formatDate(detail.data.shipmentDate)}
              />
              <MetaRow
                icon={<Truck className="h-4 w-4" />}
                label={t("cikis:carrier")}
                value={
                  carrier
                    ? `${carrier.firstName} ${carrier.lastName}`
                    : detail.data.carrierId.slice(-6)
                }
                sub={carrier?.phone}
              />
              {detail.data.recipient && (
                <>
                  <MetaRow
                    icon={<User className="h-4 w-4" />}
                    label={t("cikis:recipient_phone")}
                    value={detail.data.recipient.phone}
                  />
                  <MetaRow
                    icon={<Package className="h-4 w-4" />}
                    label={t("cikis:recipient_addressTr")}
                    value={detail.data.recipient.addressTr}
                  />
                </>
              )}
              <MetaRow
                icon={<Coins className="h-4 w-4" />}
                label={t("cikis:carrier_fee")}
                value={formatMoney(detail.data.carrierFee.amount, detail.data.carrierFee.currency)}
              />
            </div>

            {/* Items */}
            <div className="border-b p-6">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("cikis:items_label")} · {detail.data.items.length}
              </h3>
              <ul className="space-y-2">
                {detail.data.items.map((item) => {
                  const lot = lotsQuery.data?.data.find((l) => l.id === item.lotId);
                  const sender = lot
                    ? sendersQuery.data?.data.find((s) => s.id === lot.senderId)
                    : undefined;
                  const senderName = sender?.fullName?.trim() || null;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-card/50 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {lot?.firstPhotoUrl ? (
                          <img
                            src={lot.firstPhotoUrl}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 shrink-0 rounded-md border object-cover"
                          />
                        ) : (
                          <Avatar name={lot?.label || item.lotId} size="sm" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {lot?.label || (
                              <span className="font-mono text-xs text-muted-foreground">
                                #{item.lotId.slice(-6)}
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {senderName || (lot && formatDate(lot.receivedAt)) || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums">{item.qty}</p>
                        {lot?.unitPrice ? (
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(lot.unitPrice.amount, lot.unitPrice.currency)}
                            <span className="opacity-60"> / {t("common:unit_pcs")}</span>
                          </p>
                        ) : item.senderCharge ? (
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(item.senderCharge.amount, item.senderCharge.currency)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Status timeline */}
            <div className="p-6">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("track:history")}
              </h3>
              <ol className="relative ml-2 border-l border-border">
                {[...detail.data.statusHistory].reverse().map((evt, i) => {
                  const tone = STATUS_TONE[evt.toStatus as Status];
                  const isLatest = i === 0;
                  return (
                    <li key={i} className="mb-4 ml-4 last:mb-0">
                      <span
                        className={cn(
                          "absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-card",
                          tone === "success" && "bg-emerald-500",
                          tone === "warning" && "bg-amber-500",
                          tone === "danger" && "bg-rose-500",
                          tone === "info" && "bg-violet-500",
                          tone === "neutral" && "bg-slate-400",
                          tone === "muted" && "bg-zinc-400",
                          isLatest && "ring-4 ring-primary/15"
                        )}
                      />
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{t(`status:${evt.toStatus}`)}</p>
                        <Tooltip content={formatDateTime(evt.changedAt)}>
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(evt.changedAt)}
                          </span>
                        </Tooltip>
                      </div>
                      {evt.comment && (
                        <div className="mt-1 inline-flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                          <MessageSquare className="mt-0.5 h-3 w-3" />
                          {evt.comment}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {detail.data.notes && (
              <div className="border-t bg-muted/20 p-6">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("cikis:notes")}
                </h3>
                <p className="text-sm text-foreground/90">{detail.data.notes}</p>
              </div>
            )}

            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-border/60 p-4 [&:nth-child(odd)]:sm:border-r [&:nth-child(n+3)]:sm:border-t">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold">{value || "—"}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
