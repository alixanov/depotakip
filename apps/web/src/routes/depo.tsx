import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createLotSchema, type CreateLotInput, type InboundLot } from "@sadiyakargo/shared";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { categoriesApi } from "@/lib/api/categories";
import { sendersApi } from "@/lib/api/senders";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireAuth } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { formatDate } from "@/lib/format";
import { LotStatusPill } from "@/components/ui/status-pill";

const TABS = ["lots", "receive", "stock"] as const;
type Tab = (typeof TABS)[number];

/** URL state shared by all three DepoPage tabs. */
const depoSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  senderId: z.string().optional().catch(undefined),
  categoryId: z.string().optional().catch(undefined),
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
  const categoryFilter = search.categoryId ?? "";
  const availableOnly = search.available ?? true;

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch }) });
  const setPage = (p: number) => update({ page: p === 1 ? undefined : p });
  const setSenderFilter = (id: string) => update({ page: undefined, senderId: id || undefined });
  const setCategoryFilter = (id: string) =>
    update({ page: undefined, categoryId: id || undefined });
  const setAvailableOnly = (v: boolean) =>
    update({ page: undefined, available: v ? undefined : false });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { t } = useTranslation();

  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => categoriesApi.list({ active: true }),
  });

  const lotsQuery = useQuery({
    queryKey: ["lots", { page, senderFilter, categoryFilter, availableOnly }],
    queryFn: () =>
      lotsApi.list({
        page,
        limit: 20,
        senderId: senderFilter || undefined,
        categoryId: categoryFilter || undefined,
        available: availableOnly ? true : undefined,
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => lotsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lots"] }),
  });

  const senderName = (id: string) =>
    sendersQuery.data?.data.find((s) => s.id === id)?.fullName || "—";
  const categoryName = (id: string) => categoriesQuery.data?.find((c) => c.id === id)?.name || "—";

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
      cell: (l) => <span className="font-medium">{senderName(l.senderId)}</span>,
    },
    {
      key: "category",
      header: t("depo:col_category"),
      cell: (l) => categoryName(l.categoryId),
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
      key: "status",
      header: t("status"),
      cell: (l) => <LotStatusPill status={l.status} />,
      width: "140px",
    },
    {
      key: "actions",
      header: "",
      width: "100px",
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
        <div className="w-48">
          <Combobox
            options={[
              { id: "", name: t("depo:filter_categories") },
              ...(categoriesQuery.data ?? []),
            ]}
            value={categoryFilter || ""}
            onChange={setCategoryFilter}
            getValue={(c) => c.id}
            getLabel={(c) => c.name}
            placeholder={t("depo:filter_categories")}
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
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {categoryName(l.categoryId)} · {formatDate(l.receivedAt)}
                    </p>
                  </div>
                  <LotStatusPill status={l.status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm tabular-nums">
                    <span className="font-bold">{l.qtyAvailable}</span>
                    <span className="text-muted-foreground"> / {l.qtyIn}</span>
                  </span>
                  <div className="flex items-center gap-1">
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
    </div>
  );
}

function ReceiveTab() {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();

  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => categoriesApi.list({ active: true }),
  });

  const form = useForm<CreateLotInput>({
    resolver: zodResolver(createLotSchema),
    defaultValues: {
      senderId: "",
      categoryId: "",
      qtyIn: 1,
      notes: "",
      receivedAt: new Date().toISOString(),
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
    form.handleSubmit(async (data) => {
      setServerError("");
      try {
        const lot = await create.mutateAsync(data);
        toast.success(t("depo:toast_created"), {
          description: t("depo:toast_created_desc", { code: lot.id.slice(-6) }),
        });
        form.reset({
          senderId: mode === "new" ? data.senderId : "",
          categoryId: "",
          qtyIn: 1,
          notes: "",
          receivedAt: new Date().toISOString(),
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
                />
              )}
            />
            <FieldError>{form.formState.errors.senderId?.message}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label>{t("depo:col_category")}</Label>
            <Controller
              name="categoryId"
              control={form.control}
              render={({ field }) => (
                <Combobox
                  options={categoriesQuery.data ?? []}
                  value={field.value || ""}
                  onChange={field.onChange}
                  getValue={(c) => c.id}
                  getLabel={(c) => c.name}
                  renderOption={(c) => (
                    <span className="flex items-center gap-2">
                      {c.icon && <span>{c.icon}</span>}
                      <span>{c.name}</span>
                    </span>
                  )}
                  placeholder={t("select")}
                  aria-invalid={!!form.formState.errors.categoryId}
                />
              )}
            />
            <FieldError>{form.formState.errors.categoryId?.message}</FieldError>
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
            <Label>{t("depo:form_receivedAt")}</Label>
            <Input
              type="date"
              {...form.register("receivedAt", {
                setValueAs: (v) => (v ? new Date(v).toISOString() : new Date().toISOString()),
              })}
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("depo:form_notes")}</Label>
            <Input {...form.register("notes")} placeholder={t("depo:form_notes_ph")} />
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
    </Card>
  );
}

function StockTab() {
  const { t } = useTranslation();
  const byCategory = useQuery({
    queryKey: ["lots", "stock", "by-category"],
    queryFn: lotsApi.stockByCategory,
  });
  const bySender = useQuery({
    queryKey: ["lots", "stock", "by-sender"],
    queryFn: lotsApi.stockBySender,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StockCard title={t("depo:stock_by_category")} query={byCategory} />
      <StockCard title={t("depo:stock_by_sender")} query={bySender} />
    </div>
  );
}

interface StockQueryLike {
  data?: { id: string; name: string; totalAvailable: number; lots: number }[];
  isLoading: boolean;
  error: unknown;
}

function StockCard({ title, query }: { title: string; query: StockQueryLike }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {query.isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {query.error instanceof Error && (
          <p className="text-sm text-destructive">{query.error.message}</p>
        )}
        {query.data && query.data.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("depo:stock_empty")}</p>
        )}
        {query.data && query.data.length > 0 && (
          <ul className="divide-y">
            {query.data.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                <span>{row.name}</span>
                <span className="tabular-nums">
                  <span className="font-bold">{row.totalAvailable}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {t("depo:stock_lot_count", { n: row.lots })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
