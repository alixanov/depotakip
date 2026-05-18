import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CURRENCIES,
  LOT_STATUSES,
  LOT_STATUS_TONE,
  type CreateLotInput,
  type InboundLot,
  type LotStatus,
  type StatusTone,
} from "@sadiyakargo/shared";
import { Download, History, ImageIcon, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { NumberInput } from "@/components/ui/number-input";
import { DataTable, PaginationBar, type Column } from "@/components/ui/data-table";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { FieldError, FormError } from "@/components/ui/form-error";
import { downloadReceiptPdf, lotsApi } from "@/lib/api/lots";
import { sendersApi } from "@/lib/api/senders";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireAuth } from "@/lib/guards";
import { useCan } from "@/stores/auth";
import { formatDate, formatMoneyObject, isoDateOnly, toMinor } from "@/lib/format";
import { LotStatusPill } from "@/components/ui/status-pill";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import { FilterChips, type FilterChip } from "@/components/ui/filter-chips";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PhotoGalleryLightbox } from "@/components/PhotoGalleryLightbox";
import { PhotoThumb } from "@/components/PhotoThumb";
import { LotShipmentsSheet } from "@/components/LotShipmentsSheet";
import { SenderFormDialog } from "@/components/SenderFormDialog";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mirrors apps/api/.env LOT_PHOTO_MAX_COUNT/BYTES. Server-side limits are the
// source of truth; these are UX hints + early rejection so the user doesn't
// upload a 50MB file just to get a 413 back.
const PHOTO_MAX_COUNT = 10;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// Tone → dot colour. Kept local so the status filter chips can render the
// little coloured indicator without nesting a full `<LotStatusPill>`, which
// would smear its own bg+ring into the chip-button.
const DOT_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  info: "bg-violet-500",
  muted: "bg-zinc-400",
};

const TABS = ["lots", "receive", "stock"] as const;
type Tab = (typeof TABS)[number];

/** URL state shared by all three DepoPage tabs. */
const depoSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  senderId: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  status: z.enum(LOT_STATUSES).optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/depo")({
  beforeLoad: requireAuth,
  validateSearch: (s) => depoSearchSchema.parse(s),
  component: DepoPage,
});

function DepoPage() {
  const canCreate = useCan("lots:write");
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "lots";
  const setTab = (next: string) =>
    navigate({
      search: (s) => ({ ...s, tab: next === "lots" ? undefined : (next as Tab) }),
    });
  const { t } = useTranslation();

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="lots">{t("depo:tabs_lots")}</TabsTrigger>
        {canCreate && <TabsTrigger value="receive">{t("depo:tabs_receive")}</TabsTrigger>}
        <TabsTrigger value="stock">{t("depo:tabs_stock")}</TabsTrigger>
      </TabsList>
      <TabsContent value="lots">
        <LotsTab />
      </TabsContent>
      {canCreate && (
        <TabsContent value="receive">
          <ReceiveTab />
        </TabsContent>
      )}
      <TabsContent value="stock">
        <StockTab />
      </TabsContent>
    </Tabs>
  );
}

function LotsTab() {
  const qc = useQueryClient();
  const canDeleteLot = useCan("lots:delete");
  const canDeletePhoto = useCan("lots:photos:delete");
  const canReorderPhotos = useCan("lots:write");
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const senderFilter = search.senderId ?? "";
  const statusFilter = search.status ?? "";
  const dateFrom = search.from ?? "";
  const dateTo = search.to ?? "";
  const queryText = search.q ?? "";

  // Local search input (debounced into URL search) so typing doesn't push
  // a new history entry per keystroke.
  const [searchInput, setSearchInput] = useState(queryText);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Push debounced search into URL state, resetting pagination.
  if (debouncedSearch !== queryText) {
    navigate({
      search: (s) => ({ ...s, page: undefined, q: debouncedSearch || undefined }),
      replace: true,
    });
  }

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch }) });
  const setPage = (p: number) => update({ page: p === 1 ? undefined : p });
  const setSenderFilter = (id: string) => update({ page: undefined, senderId: id || undefined });
  const setStatusFilter = (s: LotStatus | "") =>
    update({ page: undefined, status: s || undefined });
  const setDateRange = (next: { from?: string; to?: string }) =>
    update({ page: undefined, from: next.from || undefined, to: next.to || undefined });
  const clearAllFilters = () =>
    navigate({
      search: (s) => ({
        ...s,
        page: undefined,
        senderId: undefined,
        status: undefined,
        from: undefined,
        to: undefined,
        q: undefined,
      }),
    });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [galleryLot, setGalleryLot] = useState<InboundLot | null>(null);
  const [historyLot, setHistoryLot] = useState<InboundLot | null>(null);
  const { t } = useTranslation();

  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });

  const lotsQuery = useQuery({
    queryKey: ["lots", { page, senderFilter, statusFilter, dateFrom, dateTo, queryText }],
    queryFn: () =>
      lotsApi.list({
        page,
        limit: 20,
        senderId: senderFilter || undefined,
        status: statusFilter || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }),
  });

  // Server doesn't support label search yet — filter client-side over the
  // current page. When `queryText` is set the count chip above the table
  // reflects the *filtered* number, not the raw page total.
  const filteredLots = (lotsQuery.data?.data ?? []).filter((l) => {
    if (!queryText) return true;
    const q = queryText.toLowerCase();
    return l.label?.toLowerCase().includes(q);
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => lotsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lots"] }),
  });

  const senderName = (id: string) =>
    sendersQuery.data?.data.find((s) => s.id === id)?.fullName || "—";

  const columns: Column<InboundLot>[] = [
    {
      key: "photo",
      header: t("depo:col_photo"),
      width: "64px",
      cell: (l) => (
        <PhotoThumb
          lotId={l.id}
          photoId={l.photos[0]?.id ?? null}
          size={40}
          onClick={l.photos.length > 0 ? () => setGalleryLot(l) : undefined}
        />
      ),
    },
    {
      key: "received",
      header: t("date"),
      cell: (l) => <span className="whitespace-nowrap">{formatDate(l.receivedAt)}</span>,
      width: "110px",
    },
    {
      key: "sender",
      header: t("depo:col_sender"),
      cell: (l) => <span className="truncate font-medium">{senderName(l.senderId)}</span>,
    },
    {
      key: "label",
      header: t("depo:col_label"),
      cell: (l) =>
        l.label ? (
          <span className="truncate">{l.label}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "qty",
      header: t("depo:col_qty"),
      cell: (l) => (
        <span className="tabular-nums whitespace-nowrap">
          <span className="font-semibold">{l.qtyAvailable}</span>
          <span className="text-muted-foreground"> / {l.qtyIn}</span>
        </span>
      ),
      width: "110px",
      className: "text-right",
    },
    {
      key: "unitPrice",
      header: t("depo:col_unitPrice"),
      cell: (l) =>
        l.unitPrice ? (
          <span className="tabular-nums whitespace-nowrap">{formatMoneyObject(l.unitPrice)}</span>
        ) : (
          <span className="text-muted-foreground">{t("depo:unitPrice_empty")}</span>
        ),
      width: "130px",
      className: "text-right",
    },
    {
      key: "status",
      header: t("status"),
      cell: (l) => <LotStatusPill status={l.status} />,
      width: "130px",
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      className: "text-right",
      cell: (l) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => downloadReceiptPdf(l.id)}
            aria-label={t("depo:pdf_aria")}
          >
            <Download className="h-4 w-4" />
          </Button>
          {l.qtyAvailable < l.qtyIn && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryLot(l)}
              aria-label={t("depo:shipments_aria")}
            >
              <History className="h-4 w-4" />
            </Button>
          )}
          {canDeleteLot && l.qtyAvailable === l.qtyIn && (
            <Button variant="ghost" size="icon" onClick={() => setConfirmId(l.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Build active-filter chip list for the toolbar — one chip per non-default
  // filter, plus a "clear all" link via the FilterChips contract.
  const formatRange = () => {
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} → ${formatDate(dateTo)}`;
    if (dateFrom) return `${formatDate(dateFrom)} →`;
    if (dateTo) return `→ ${formatDate(dateTo)}`;
    return "—";
  };
  const activeChips: FilterChip[] = [];
  if (queryText) {
    activeChips.push({
      key: "q",
      label: (
        <>
          {t("depo:filter_active_search")}: <span className="font-semibold">{queryText}</span>
        </>
      ),
      onClear: () => {
        setSearchInput("");
        update({ page: undefined, q: undefined });
      },
    });
  }
  if (senderFilter) {
    activeChips.push({
      key: "sender",
      label: (
        <>
          {t("depo:filter_active_sender")}:{" "}
          <span className="font-semibold">{senderName(senderFilter)}</span>
        </>
      ),
      onClear: () => setSenderFilter(""),
    });
  }
  if (statusFilter) {
    activeChips.push({
      key: "status",
      label: (
        <>
          {t("depo:filter_active_status")}:{" "}
          <span className="font-semibold">{t(`depo:status_${statusFilter}`)}</span>
        </>
      ),
      onClear: () => setStatusFilter(""),
    });
  }
  if (dateFrom || dateTo) {
    activeChips.push({
      key: "range",
      label: (
        <>
          {t("depo:filter_active_period")}: <span className="font-semibold">{formatRange()}</span>
        </>
      ),
      onClear: () => setDateRange({}),
    });
  }

  return (
    <div className="space-y-3">
      {/* Top filter bar — search (left, takes remaining space) + sender +
       *  date range + availability checkbox. All filters reset pagination. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("depo:filter_label_ph")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Combobox
            options={[
              { id: "", fullName: t("depo:filter_senders") },
              ...(sendersQuery.data?.data ?? []),
            ]}
            value={senderFilter || ""}
            onChange={setSenderFilter}
            getValue={(s) => s.id}
            getLabel={(s) => s.fullName}
            getSearchKeys={(s) => ("phone" in s && typeof s.phone === "string" ? [s.phone] : [])}
            placeholder={t("depo:filter_senders")}
          />
        </div>
        <DateRangePicker
          from={dateFrom || undefined}
          to={dateTo || undefined}
          onChange={setDateRange}
          placeholder={t("depo:filter_period")}
          className="w-60"
        />
      </div>

      {/* Status chips — clickable filter, mutually exclusive with "all". */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t("status")}>
        <button
          type="button"
          role="tab"
          aria-selected={!statusFilter}
          onClick={() => setStatusFilter("")}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
            !statusFilter
              ? "border-primary bg-primary-soft text-primary-soft-foreground"
              : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          )}
        >
          {t("depo:filter_status_all")}
        </button>
        {LOT_STATUSES.map((s) => {
          const active = statusFilter === s;
          const tone = LOT_STATUS_TONE[s];
          // Render dot+label directly. Embedding <LotStatusPill> double-stacks
          // its own tone bg+ring on top of the chip's border — in dark mode
          // `dark:bg-rose-900/30` beats our `bg-transparent` override and
          // produces the "smudged glow" look reported in the screenshot.
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                active
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", DOT_TONE_CLASS[tone])} />
              {t(`depo:status_${s}`)}
            </button>
          );
        })}
      </div>

      {/* Results count + chip-row with active filters and one-click clear-all */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary" size="lg">
          <ImageIcon className="h-3 w-3" />
          {t("depo:filter_results", { n: filteredLots.length })}
        </Badge>
        <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredLots}
            loading={lotsQuery.isLoading}
            error={lotsQuery.error as Error | null}
            rowKey={(l) => l.id}
            renderCard={(l) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{senderName(l.senderId)}</p>
                    {l.label && (
                      <p className="truncate text-xs font-medium text-foreground/80">{l.label}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(l.receivedAt)}
                    </p>
                  </div>
                  <LotStatusPill status={l.status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm tabular-nums">
                      <span className="font-bold">{l.qtyAvailable}</span>
                      <span className="text-muted-foreground"> / {l.qtyIn}</span>
                    </span>
                    {l.unitPrice && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatMoneyObject(l.unitPrice)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadReceiptPdf(l.id)}
                      aria-label={t("depo:pdf_aria")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {l.qtyAvailable < l.qtyIn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setHistoryLot(l)}
                        aria-label={t("depo:shipments_aria")}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteLot && l.qtyAvailable === l.qtyIn && (
                      <Button variant="ghost" size="icon" onClick={() => setConfirmId(l.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            empty={t("depo:empty")}
          />
          <PaginationBar pagination={lotsQuery.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t("depo:delete_title")}
        description={t("depo:delete_desc")}
        destructive
        pending={removeMutation.isPending}
        onConfirm={() => {
          if (confirmId) {
            removeMutation.mutate(confirmId, { onSettled: () => setConfirmId(null) });
          }
        }}
      />

      {galleryLot && (
        <PhotoGalleryLightbox
          lotId={galleryLot.id}
          photos={
            // Stay in sync with the latest list — after a reorder/delete the
            // server returns a new array, so we read it from the cache rather
            // than the stale `galleryLot` snapshot captured on open.
            lotsQuery.data?.data.find((l) => l.id === galleryLot.id)?.photos ?? galleryLot.photos
          }
          open={!!galleryLot}
          onOpenChange={(o) => !o && setGalleryLot(null)}
          canDelete={canDeletePhoto}
          canReorder={canReorderPhotos}
        />
      )}

      <LotShipmentsSheet
        lotId={historyLot?.id ?? null}
        lotLabel={
          historyLot
            ? `${senderName(historyLot.senderId)}${historyLot.label ? ` — ${historyLot.label}` : ""}`
            : undefined
        }
        onOpenChange={(o) => !o && setHistoryLot(null)}
      />
    </div>
  );
}

/**
 * Form values use *display* units (e.g. 50.00 USD). Conversion to minor units
 * (5000 cents) happens at submit time — same pattern as cikis.tsx. Both
 * `label` and `unitPrice` are optional; an empty amount means "no price".
 */
const receiveFormSchema = z.object({
  senderId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Gönderici seçin"),
  label: z.string().trim().max(120).default(""),
  qtyIn: z.coerce.number().int().positive(),
  unitPriceAmount: z.coerce.number().nonnegative().optional(),
  unitPriceCurrency: z.enum(CURRENCIES),
  receivedAt: z.string().min(1),
  notes: z.string().trim().max(1000).default(""),
});

type ReceiveFormValues = z.infer<typeof receiveFormSchema>;

function ReceiveTab() {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([]);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);
  const { t } = useTranslation();

  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });

  const form = useForm<ReceiveFormValues>({
    resolver: zodResolver(receiveFormSchema),
    defaultValues: {
      senderId: "",
      label: "",
      qtyIn: 1,
      unitPriceAmount: undefined,
      unitPriceCurrency: "USD",
      notes: "",
      receivedAt: isoDateOnly(),
    },
  });
  const handleApiError = useApiFormErrors(form);

  const create = useMutation({
    mutationFn: (data: CreateLotInput) => lotsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lots"] });
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  // Save modes:
  //   "close" — full reset (clear sender too); the default Save button.
  //   "new"   — keep `senderId`, clear the rest; ideal for receiving multiple
  //             lots from the same supplier back-to-back.
  type SaveMode = "close" | "new";
  const submit = (mode: SaveMode) =>
    form.handleSubmit(async (values) => {
      setServerError("");
      const payload: CreateLotInput = {
        senderId: values.senderId,
        label: values.label || undefined,
        qtyIn: values.qtyIn,
        unitPrice:
          values.unitPriceAmount && values.unitPriceAmount > 0
            ? { amount: toMinor(values.unitPriceAmount), currency: values.unitPriceCurrency }
            : null,
        // `notes` is required-with-default in CreateLotInput (not optional),
        // so we always send a string — empty becomes "" server-side.
        notes: values.notes,
        // DatePicker yields a yyyy-mm-dd local-date string; backend
        // createLotSchema requires `.datetime()`. We anchor at 12:00 UTC so
        // operators in either +N or -N timezones see the day they picked
        // when the value is round-tripped through Intl.DateTimeFormat.
        receivedAt: `${values.receivedAt}T12:00:00.000Z`,
      };
      try {
        const lot = await create.mutateAsync(payload);
        toast.success(t("depo:toast_created"), {
          description: t("depo:toast_created_desc", { code: lot.id.slice(-6) }),
        });
        // Two-step photo upload (POST /lots/:id/photos after the lot exists). On failure
        // the lot is already in the DB; surface a separate toast so the user
        // can re-attempt via the gallery later.
        if (stagedPhotos.length > 0) {
          try {
            await lotsApi.uploadPhotos(lot.id, stagedPhotos);
            toast.success(t("photo:toast_uploaded", { n: stagedPhotos.length }));
          } catch (err) {
            toast.error(t("photo:toast_upload_failed"), {
              description: err instanceof Error ? err.message : undefined,
              duration: 8000,
            });
          }
          qc.invalidateQueries({ queryKey: ["lots"] });
        }
        setStagedPhotos([]);
        form.reset({
          senderId: mode === "new" ? values.senderId : "",
          label: "",
          qtyIn: 1,
          unitPriceAmount: undefined,
          unitPriceCurrency: values.unitPriceCurrency,
          notes: "",
          receivedAt: isoDateOnly(),
        });
      } catch {
        // handled by mutation.onError → setServerError
      }
    });

  // Keyboard shortcuts on the form scope:
  //   Cmd/Ctrl+Enter         → save & keep sender (most-frequent op)
  //   Cmd/Ctrl+Shift+Enter   → save & close (full reset)
  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit(e.shiftKey ? "close" : "new")();
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-4 text-lg font-bold">{t("depo:form_title")}</h2>
        <form
          onSubmit={submit("close")}
          onKeyDown={onKeyDown}
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormError className="sm:col-span-2">{serverError}</FormError>

          <div className="space-y-1.5">
            <Label>{t("depo:col_sender")}</Label>
            <Controller
              name="senderId"
              control={form.control}
              render={({ field }) => (
                <Combobox
                  options={sendersQuery.data?.data ?? []}
                  value={field.value || ""}
                  onChange={field.onChange}
                  getValue={(s) => s.id}
                  getLabel={(s) => s.fullName}
                  getSearchKeys={(s) => [s.phone]}
                  renderOption={(s) => (
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{s.fullName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {s.phone}
                      </span>
                    </div>
                  )}
                  placeholder={t("select")}
                  aria-invalid={!!form.formState.errors.senderId}
                  footer={
                    <button
                      type="button"
                      onClick={() => setSenderDialogOpen(true)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-primary-soft"
                    >
                      <Plus className="h-4 w-4" />
                      {t("admin:btn_new_sender")}
                    </button>
                  }
                />
              )}
            />
            <FieldError>{form.formState.errors.senderId?.message}</FieldError>
          </div>

          {/* Pair "Дата приёмки" with sender — both are receipt-event metadata.
              Товарные поля (qty, unit price) идут ниже своей группой. */}
          <div className="space-y-1.5">
            <Label>{t("depo:form_receivedAt")}</Label>
            <Controller
              name="receivedAt"
              control={form.control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? isoDateOnly())}
                />
              )}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("depo:form_label")}</Label>
            <Input
              {...form.register("label")}
              placeholder={t("depo:form_label_ph")}
              aria-invalid={!!form.formState.errors.label}
            />
            <FieldError>{form.formState.errors.label?.message}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label>{t("depo:form_qty")}</Label>
            <Controller
              name="qtyIn"
              control={form.control}
              render={({ field }) => (
                <NumberInput value={field.value} onChange={field.onChange} min={1} />
              )}
            />
            <FieldError>{form.formState.errors.qtyIn?.message}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label>{t("depo:form_unitPrice")}</Label>
            <div className="flex gap-1.5">
              <Controller
                name="unitPriceAmount"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    min={0}
                    className="flex-1"
                  />
                )}
              />
              <Controller
                name="unitPriceCurrency"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-20 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <FieldError>{form.formState.errors.unitPriceAmount?.message}</FieldError>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("depo:form_notes")}</Label>
            <Textarea {...form.register("notes")} rows={3} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("depo:form_photos")}</Label>
            <PhotoPicker
              value={stagedPhotos}
              onChange={setStagedPhotos}
              maxCount={PHOTO_MAX_COUNT}
              maxBytes={PHOTO_MAX_BYTES}
              disabled={form.formState.isSubmitting}
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="submit" loading={form.formState.isSubmitting}>
              {!form.formState.isSubmitting && <Plus className="mr-1 h-4 w-4" />}
              {t("depo:form_save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit("new")()}
              disabled={form.formState.isSubmitting}
            >
              {t("depo:form_save_and_new")}
            </Button>
            <span className="text-[11px] text-muted-foreground sm:ml-auto">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
                ⌘↵
              </kbd>{" "}
              {t("depo:form_hint_save_new")}
            </span>
          </div>
        </form>
      </CardContent>
      <SenderFormDialog
        open={senderDialogOpen}
        onOpenChange={setSenderDialogOpen}
        onCreated={(sender) => {
          // Auto-select the freshly created sender + invalidate the cached
          // list so the Combobox sees the new entry on its next open.
          form.setValue("senderId", sender.id, { shouldValidate: true });
          qc.invalidateQueries({ queryKey: ["senders"] });
        }}
      />
    </Card>
  );
}

/**
 * Stock = lots with qtyAvailable > 0, shown as a rich per-lot table:
 *   [photo] | label | unit price | qty | sender
 *
 * Filters: sender (combobox) + label search (debounced). Filtering happens on
 * the client because lots/list does not yet support label search server-side —
 * the dataset is bounded (server returns at most `limit` items per page).
 */
const STOCK_PAGE_LIMIT = 200;

function StockTab() {
  const { t } = useTranslation();
  const [senderFilter, setSenderFilter] = useState("");
  const [search, setSearch] = useState("");
  const [galleryLot, setGalleryLot] = useState<InboundLot | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });
  // STOCK_PAGE_LIMIT covers small/mid warehouses without pagination noise.
  // If `pagination.total` exceeds it we surface a banner so the user knows the
  // view is partial — until server-side label search + paging are added here.
  const lotsQuery = useQuery({
    queryKey: ["lots", "stock", { senderFilter }],
    queryFn: () =>
      lotsApi.list({
        limit: STOCK_PAGE_LIMIT,
        available: true,
        senderId: senderFilter || undefined,
      }),
  });
  const total = lotsQuery.data?.pagination.total ?? 0;
  const truncated = total > STOCK_PAGE_LIMIT;

  const senderName = (id: string) =>
    sendersQuery.data?.data.find((s) => s.id === id)?.fullName || "—";

  const filtered = (lotsQuery.data?.data ?? []).filter((l) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return l.label?.toLowerCase().includes(q);
  });

  const columns: Column<InboundLot>[] = [
    {
      key: "photo",
      header: t("depo:col_photo"),
      width: "72px",
      cell: (l) => (
        <PhotoThumb
          lotId={l.id}
          photoId={l.photos[0]?.id ?? null}
          size={48}
          onClick={l.photos.length > 0 ? () => setGalleryLot(l) : undefined}
        />
      ),
    },
    {
      key: "label",
      header: t("depo:col_label"),
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate font-medium">
            {l.label || <span className="text-muted-foreground">—</span>}
          </div>
          <div className="truncate text-xs text-muted-foreground">{formatDate(l.receivedAt)}</div>
        </div>
      ),
    },
    {
      key: "unitPrice",
      header: t("depo:col_unitPrice"),
      width: "120px",
      className: "text-right",
      cell: (l) =>
        l.unitPrice ? (
          <span className="tabular-nums">{formatMoneyObject(l.unitPrice)}</span>
        ) : (
          <span className="text-muted-foreground">{t("depo:unitPrice_empty")}</span>
        ),
    },
    {
      key: "qty",
      header: t("depo:col_qty"),
      width: "110px",
      className: "text-right",
      cell: (l) => (
        <span className="tabular-nums">
          <span className="font-bold">{l.qtyAvailable}</span>
          <span className="text-muted-foreground"> / {l.qtyIn}</span>
        </span>
      ),
    },
    {
      key: "sender",
      header: t("depo:col_sender"),
      cell: (l) => <span className="truncate">{senderName(l.senderId)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Input
            placeholder={t("depo:stock_search_ph")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Combobox
            options={[
              { id: "", fullName: t("depo:filter_senders") },
              ...(sendersQuery.data?.data ?? []),
            ]}
            value={senderFilter}
            onChange={setSenderFilter}
            getValue={(s) => s.id}
            getLabel={(s) => s.fullName}
            placeholder={t("depo:filter_senders")}
          />
        </div>
      </div>

      {truncated && (
        <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
          {t("depo:stock_partial", { shown: STOCK_PAGE_LIMIT, total })}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            loading={lotsQuery.isLoading}
            error={lotsQuery.error as Error | null}
            rowKey={(l) => l.id}
            empty={t("depo:stock_empty")}
            renderCard={(l) => (
              <div className="flex gap-3">
                <PhotoThumb
                  lotId={l.id}
                  photoId={l.photos[0]?.id ?? null}
                  size={64}
                  onClick={l.photos.length > 0 ? () => setGalleryLot(l) : undefined}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold">
                      {l.label || <span className="text-muted-foreground">—</span>}
                    </p>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-bold">{l.qtyAvailable}</span>
                      <span className="text-muted-foreground"> / {l.qtyIn}</span>
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {senderName(l.senderId)} · {formatDate(l.receivedAt)}
                  </p>
                  {l.unitPrice && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatMoneyObject(l.unitPrice)}
                    </p>
                  )}
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {galleryLot && (
        <PhotoGalleryLightbox
          lotId={galleryLot.id}
          photos={galleryLot.photos}
          open={!!galleryLot}
          onOpenChange={(o) => !o && setGalleryLot(null)}
        />
      )}
    </div>
  );
}
