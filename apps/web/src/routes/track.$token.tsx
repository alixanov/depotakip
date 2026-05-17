import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Boxes, Check, Copy, ExternalLink, MapPin, Package, Share2, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Status } from "@sadiyakargo/shared";
import { STATUS_TONE } from "@sadiyakargo/shared";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shipmentsApi } from "@/lib/api/shipments";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/track/$token")({
  component: TrackPage,
});

/** 4-step user-facing progress: Bekliyor → Yolda → Teslim (+ Kayip/Iptal terminal). */
const PROGRESS_STEPS: { key: Status; icon: typeof Boxes }[] = [
  { key: "bekliyor", icon: Boxes },
  { key: "yolda", icon: Truck },
  { key: "teslim", icon: Check },
];

const TERMINAL_OK: Status[] = ["teslim"];
const TERMINAL_FAIL: Status[] = ["kayip", "iptal"];
const TERMINAL: Status[] = [...TERMINAL_OK, ...TERMINAL_FAIL];

function progressIndex(status: Status): number {
  if (status === "teslim") return 2;
  if (status === "yolda") return 1;
  if (status === "bekliyor") return 0;
  return -1;
}

function TrackPage() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["public-track", token],
    queryFn: () => shipmentsApi.publicTrack(token),
    retry: false,
    // Poll every 60s while the shipment is still in motion. Stop on terminal states.
    refetchInterval: (q) =>
      q.state.data && TERMINAL.includes(q.state.data.status) ? false : 60_000,
  });

  const shipment = query.data;
  // Document metadata: surface shortCode + status in the browser tab + link previews.
  const docTitle = shipment
    ? `${shipment.shortCode} · ${t(`status:${shipment.status}`)}`
    : "Sadiya Kargo";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("track:link_copied"));
    } catch {
      toast.error(t("error"));
    }
  };

  const shareLink = async () => {
    if (!shipment) return;
    const shareData = {
      title: `${shipment.shortCode} · Sadiya Kargo`,
      text: t("track:share_text", {
        code: shipment.shortCode,
        status: t(`status:${shipment.status}`),
      }),
      url: window.location.href,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed — fall back to copy.
      }
    }
    void copyLink();
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* React 19 Document Metadata — sets <title> on the public tracking page. */}
      <title>{docTitle}</title>
      <meta
        name="description"
        content={t("track:meta_description", { code: shipment?.shortCode ?? "" })}
      />
      {/* Hero ambient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-50 dark:opacity-25"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -10%, hsl(233 88% 60% / 0.30), transparent 60%), radial-gradient(700px 320px at 90% 10%, hsl(280 76% 60% / 0.22), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {/* Brand mark */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} className="rounded-xl shadow-brand-glow" />
            <BrandWordmark className="text-base" />
          </div>
        </div>

        <Card className="overflow-hidden border-border/60 shadow-soft-lg">
          {query.isLoading && (
            <CardContent className="space-y-4 p-8">
              <Skeleton className="mx-auto h-6 w-32" />
              <Skeleton className="mx-auto h-12 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </CardContent>
          )}

          {query.error && (
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Package className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-semibold text-destructive">{t("track:invalid")}</p>
            </CardContent>
          )}

          {query.data && (
            <>
              {/* Hero status block */}
              <div
                className={cn(
                  "p-8 text-center",
                  TERMINAL_OK.includes(query.data.status) &&
                    "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20",
                  TERMINAL_FAIL.includes(query.data.status) &&
                    "bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20",
                  !TERMINAL_OK.includes(query.data.status) &&
                    !TERMINAL_FAIL.includes(query.data.status) &&
                    "bg-gradient-to-br from-primary/5 to-primary-soft"
                )}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {query.data.shortCode}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  {t(`status:${query.data.status}_full`, {
                    defaultValue: t(`status:${query.data.status}`),
                  })}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("track:lastUpdate")}:{" "}
                  <span className="font-medium text-foreground">
                    {formatRelativeTime(
                      query.data.statusHistory[query.data.statusHistory.length - 1]?.changedAt ??
                        query.data.shipmentDate
                    )}
                  </span>
                </p>

                <div className="mt-3 flex justify-center gap-2">
                  {canShare && (
                    <Button variant="brand" size="sm" onClick={shareLink}>
                      <Share2 className="h-3.5 w-3.5" />
                      {t("track:share")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" />
                    {t("track:copy_link")}
                  </Button>
                </div>
              </div>

              {/* Progress steps visualization */}
              <div className="border-t bg-card/50 px-8 py-6">
                <ProgressBar current={query.data.status} />
              </div>

              {/* Metadata grid */}
              <div className="grid border-t md:grid-cols-2">
                <MetaCell
                  icon={<Boxes className="h-4 w-4" />}
                  label={t("track:shipmentDate")}
                  value={formatDate(query.data.shipmentDate)}
                />
                <MetaCell
                  icon={<Package className="h-4 w-4" />}
                  label={t("track:totalItems")}
                  value={String(query.data.totalItems)}
                />
                {query.data.recipient && (
                  <>
                    <MetaCell
                      icon={<Truck className="h-4 w-4" />}
                      label={t("track:recipient")}
                      value={query.data.recipient.name}
                    />
                    <MetaCell
                      icon={<MapPin className="h-4 w-4" />}
                      label={t("track:city")}
                      value={query.data.recipient.cityHint}
                      sub={query.data.recipient.phoneMasked}
                    />
                  </>
                )}
              </div>

              {/* Timeline */}
              <div className="border-t p-6">
                <h2 className="mb-4 text-sm font-semibold">{t("track:history")}</h2>
                <ol className="relative ml-1.5 border-l border-border">
                  {[...query.data.statusHistory].reverse().map((evt, i) => {
                    const tone = STATUS_TONE[evt.toStatus];
                    return (
                      <li key={i} className="mb-4 ml-4 last:mb-0">
                        <span
                          className={cn(
                            "absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-background",
                            tone === "success" && "bg-emerald-500",
                            tone === "warning" && "bg-amber-500",
                            tone === "danger" && "bg-rose-500",
                            tone === "info" && "bg-violet-500",
                            tone === "neutral" && "bg-slate-400",
                            tone === "muted" && "bg-zinc-400"
                          )}
                        />
                        <p className="text-sm font-semibold">{t(`status:${evt.toStatus}`)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(evt.changedAt)}
                          <span className="mx-1 opacity-60">·</span>
                          {formatDateTime(evt.changedAt)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <ExternalLink className="mr-1 inline h-3 w-3" />
          {t("track:powered_by")}{" "}
          <span className="font-semibold text-foreground">Sadiya Kargo</span>
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ current }: { current: Status }) {
  const { t } = useTranslation();
  const idx = progressIndex(current);
  const failed = TERMINAL_FAIL.includes(current);

  if (failed) {
    return (
      <div className="text-center text-sm text-rose-700 dark:text-rose-300">
        <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 font-semibold dark:bg-rose-900/30">
          {t(`status:${current}`)}
        </span>
      </div>
    );
  }

  return (
    <ol className="flex items-center">
      {PROGRESS_STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = idx >= i;
        const active = idx === i;
        const isLast = i === PROGRESS_STEPS.length - 1;
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-500",
                  done
                    ? "bg-gradient-to-br from-primary to-primary/70 text-white shadow-brand-glow"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.4} />
                {active && (
                  <span
                    className="absolute -inset-1 animate-status-ping rounded-full bg-primary/40"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {t(`status:${step.key}`)}
              </span>
            </div>
            {!isLast && (
              <div className="mx-2 mt-[-18px] h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700"
                  style={{ width: idx > i ? "100%" : "0%" }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MetaCell({
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
    <div className="flex items-start gap-3 border-border/60 p-4 md:[&:nth-child(odd)]:border-r md:[&:nth-child(n+3)]:border-t">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">{value || "—"}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
