import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CURRENCIES, type CreateLotInput, type InboundLot } from "@sadiyakargo/shared";
import { Download, ImageIcon, Plus, Trash2 } from "lucide-react";
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
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatMoneyObject, isoDateOnly, toMinor } from "@/lib/format";
import { LotStatusPill } from "@/components/ui/status-pill";
import { DatePicker } from "@/components/ui/date-picker";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PhotoGalleryLightbox } from "@/components/PhotoGalleryLightbox";
import { PhotoThumb } from "@/components/PhotoThumb";
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

const TABS = ["lots", "receive", "stock"] as const;
type Tab = (typeof TABS)[number];

/** URL state shared by all three DepoPage tabs. */
const depoSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  senderId: z.string().optional().catch(undefined),
  available: z.coerce.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/depo")({
  beforeLoad: requireAuth,
  validateSearch: (s) => depoSearchSchema.parse(s),
  component: DepoPage,
});

function DepoPage() {
  const role = useAuthStore((s) => s.user?.role);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "lots";
  const setTab = (next: string) =>
    navigate({
      search: (s) => ({ ...s, tab: next === "lots" ? undefined : (next as Tab) }),
    });
  const canCreate = role === "admin" || role === "operator";
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
  const role = useAuthStore((s) => s.user?.role);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const senderFilter = search.senderId ?? "";
  const availableOnly = search.available ?? true;

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch }) });
  const setPage = (p: number) => update({ page: p === 1 ? undefined : p });
  const setSenderFilter = (id: string) => update({ page: undefined, senderId: id || undefined });
  const setAvailableOnly = (v: boolean) =>
    update({ page: undefined, available: v ? undefined : false });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [galleryLot, setGalleryLot] = useState<InboundLot | null>(null);
  const { t } = useTranslation();

  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });

  const lotsQuery = useQuery({
    queryKey: ["lots", { page, senderFilter, availableOnly }],
    queryFn: () =>
      lotsApi.list({
        page,
        limit: 20,
        senderId: senderFilter || undefined,
        available: availableOnly ? true : undefined,
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => lotsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lots"] }),
  });

  const senderName = (id: string) =>
    sendersQuery.data?.data.find((s) => s.id === id)?.fullName || "—";

  const columns: Column<InboundLot>[] = [
    {
      key: "received",
      header: t("date"),
      cell: (l) => formatDate(l.receivedAt),
      width: "100px",
    },
    {
      key: "sender",
      header: t("depo:col_sender"),
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{senderName(l.senderId)}</div>
          {l.label && <div className="truncate text-xs text-muted-foreground">{l.label}</div>}
        </div>
      ),
    },
    {
      key: "qty",
      header: t("depo:col_qty"),
      cell: (l) => (
        <span>
          {l.qtyAvailable}
          <span className="text-muted-foreground"> / {l.qtyIn}</span>
        </span>
      ),
      width: "100px",
    },
    {
      key: "unitPrice",
      header: t("depo:col_unitPrice"),
      cell: (l) =>
        l.unitPrice ? (
          <span className="tabular-nums">{formatMoneyObject(l.unitPrice)}</span>
        ) : (
          <span className="text-muted-foreground">{t("depo:unitPrice_empty")}</span>
        ),
      width: "120px",
      className: "text-right",
    },
    {
      key: "status",
      header: t("status"),
      cell: (l) => <LotStatusPill status={l.status} />,
      width: "140px",
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      className: "text-right",
      cell: (l) => (
        <div className="flex justify-end gap-1">
          {l.photos.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGalleryLot(l)}
              aria-label={t("photo:open_gallery_aria")}
              className="gap-1 px-2"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs tabular-nums">{l.photos.length}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => downloadReceiptPdf(l.id)}
            aria-label={t("depo:pdf_aria")}
          >
            <Download className="h-4 w-4" />
          </Button>
          {role === "admin" && l.qtyAvailable === l.qtyIn && (
            <Button variant="ghost" size="icon" onClick={() => setConfirmId(l.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
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
        <label className="flex h-11 items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          {t("depo:filter_available")}
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={lotsQuery.data?.data}
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
                    {l.photos.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setGalleryLot(l)}
                        aria-label={t("photo:open_gallery_aria")}
                        className="gap-1 px-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        <span className="text-xs tabular-nums">{l.photos.length}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadReceiptPdf(l.id)}
                      aria-label={t("depo:pdf_aria")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {role === "admin" && l.qtyAvailable === l.qtyIn && (
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
          canDelete={role === "admin"}
          canReorder={role === "admin" || role === "operator"}
        />
      )}
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
        notes: values.notes,
        // DatePicker keeps yyyy-mm-dd; backend createLotSchema requires full ISO.
        receivedAt: new Date(values.receivedAt).toISOString(),
      };
      try {
        const lot = await create.mutateAsync(payload);
        toast.success(t("depo:toast_created"), {
          description: t("depo:toast_created_desc", { code: lot.id.slice(-6) }),
        });
        // Two-step photo upload (TZ §6.5 — POST /lots/:id/photos). On failure
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
  // 200 covers small/mid warehouses without pagination noise. If stock grows
  // past that we add server-side pagination + search params here.
  const lotsQuery = useQuery({
    queryKey: ["lots", "stock", { senderFilter }],
    queryFn: () =>
      lotsApi.list({
        limit: 200,
        available: true,
        senderId: senderFilter || undefined,
      }),
  });

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
