import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  TRANSACTION_KINDS,
  type CreateTransactionInput,
  type Transaction,
  type TransactionKind,
} from "@sadiyakargo/shared";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  DataTable,
  PaginationBar,
  sortToParam,
  type Column,
  type SortState,
} from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { FieldError, FormError } from "@/components/ui/form-error";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { downloadPaymentReceipt, transactionsApi } from "@/lib/api/transactions";
import { carriersApi } from "@/lib/api/carriers";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireAuth } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatUsdCents, toMinor } from "@/lib/format";

/** Display-units form schema for payment dialog. amount in display units (e.g. 50.00). */
const paymentFormSchema = z.object({
  kind: z.enum(TRANSACTION_KINDS),
  counterparty: z.object({
    type: z.literal("carrier"),
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Karşı taraf seçin"),
  }),
  amount: z.coerce.number().positive("Tutar > 0 olmalı"),
  currency: z.enum(CURRENCIES),
  method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(1000).default(""),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

type Tab = "balances" | "tx";

const finansSearchSchema = z.object({
  tab: z.enum(["balances", "tx"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  kind: z.enum(TRANSACTION_KINDS).optional().catch(undefined),
  sortKey: z.enum(["txDate", "amount"]).optional().catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export const Route = createFileRoute("/finans")({
  beforeLoad: requireAuth,
  validateSearch: (s) => finansSearchSchema.parse(s),
  component: FinansPage,
});

function FinansPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canMutate = role === "admin" || role === "operator";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "balances";
  const setTab = (next: string) =>
    navigate({
      search: (s) => ({ ...s, tab: next === "balances" ? undefined : (next as Tab) }),
    });
  const { t } = useTranslation();

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="balances">{t("finans:tab_balances")}</TabsTrigger>
          <TabsTrigger value="tx">{t("finans:tab_tx")}</TabsTrigger>
        </TabsList>
        {canMutate && <PaymentDialogTrigger />}
      </div>

      <TabsContent value="balances">
        <BalancesTab />
      </TabsContent>
      <TabsContent value="tx">
        <TxTab />
      </TabsContent>
    </Tabs>
  );
}

function BalancesTab() {
  const { t } = useTranslation();
  const carriersQuery = useQuery({
    queryKey: ["balances", "carriers"],
    queryFn: transactionsApi.carrierBalances,
  });

  return (
    <div className="grid gap-4">
      <BalanceCard
        title={t("finans:balances_carriers")}
        rows={carriersQuery.data}
        loading={carriersQuery.isLoading}
        error={carriersQuery.error as Error | null}
      />
    </div>
  );
}

function BalanceCard({
  title,
  rows,
  loading,
  error,
}: {
  title: string;
  rows:
    | {
        counterpartyId: string;
        name: string;
        balanceUsd: number;
        debitUsd: number;
        creditUsd: number;
      }[]
    | undefined;
  loading: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {rows && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("finans:balances_empty")}</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.counterpartyId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("finans:balances_debit_credit", {
                      debit: formatUsdCents(r.debitUsd),
                      credit: formatUsdCents(r.creditUsd),
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    r.balanceUsd > 0 ? "text-amber-600" : "text-emerald-600"
                  )}
                >
                  {formatUsdCents(r.balanceUsd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function useKindLabel() {
  const { t } = useTranslation();
  return (k: TransactionKind) => t(`finans:kind_${k}`);
}

function TxTab() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const kindFilter: TransactionKind | "" = search.kind ?? "";
  const sort: SortState | undefined = search.sortKey
    ? { key: search.sortKey, dir: search.sortDir ?? "desc" }
    : undefined;
  const setPage = (p: number) =>
    navigate({ search: (s) => ({ ...s, page: p === 1 ? undefined : p }) });
  const setKindFilter = (kind: TransactionKind | "") =>
    navigate({ search: (s) => ({ ...s, page: undefined, kind: kind || undefined }) });
  const setSort = (next: SortState | undefined) =>
    navigate({
      search: (s) => ({
        ...s,
        sortKey: next?.key as "txDate" | "amount" | undefined,
        sortDir: next?.dir,
      }),
    });
  const { t } = useTranslation();
  const kindLabel = useKindLabel();

  const query = useQuery({
    queryKey: ["transactions", { page, kindFilter, sort }],
    queryFn: () =>
      transactionsApi.list({
        page,
        limit: 20,
        kind: kindFilter || undefined,
        sort: sortToParam(sort),
      }),
  });

  const columns: Column<Transaction>[] = [
    {
      key: "date",
      header: t("date"),
      cell: (tx) => formatDate(tx.txDate),
      width: "100px",
      sortKey: "txDate",
    },
    {
      key: "kind",
      header: t("finans:tx_col_kind"),
      cell: (tx) => kindLabel(tx.kind),
    },
    {
      key: "party",
      header: t("finans:tx_col_party"),
      cell: (tx) => `${tx.counterparty.type}: ${tx.counterparty.id.slice(-6)}`,
    },
    {
      key: "amount",
      header: t("finans:tx_col_amount"),
      cell: (tx) => <span className="tabular-nums">{formatMoney(tx.amount, tx.currency)}</span>,
      width: "120px",
      sortKey: "amount",
    },
    {
      key: "direction",
      header: t("finans:tx_col_dir"),
      cell: (tx) => (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            tx.direction === "debit"
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          )}
        >
          {tx.direction}
        </span>
      ),
      width: "80px",
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      className: "text-right",
      cell: (tx) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => downloadPaymentReceipt(tx.id)}
          aria-label="PDF"
        >
          <Download className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as TransactionKind | "")}
          className="h-11 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{t("finans:filter_all_kinds")}</option>
          {TRANSACTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data?.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(tx) => tx.id}
            empty={t("finans:tx_empty")}
            sort={sort}
            onSortChange={setSort}
          />
          <PaginationBar pagination={query.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentDialogTrigger() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        {t("finans:btn_payment")}
      </Button>
      {open && <PaymentDialog open onClose={() => setOpen(false)} />}
    </>
  );
}

function PaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const kindLabel = useKindLabel();
  // Stable Idempotency-Key for this dialog instance — protects against
  // double-click / TanStack Query retry creating duplicate transactions.
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());
  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 200 }),
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      kind: "carrier_payment",
      counterparty: { type: "carrier", id: "" },
      amount: 0,
      currency: "USD",
      method: "cash",
      notes: "",
    },
  });
  const handleApiError = useApiFormErrors(form);

  const kind = form.watch("kind");
  const inferredDirection: "debit" | "credit" = kind === "carrier_payment" ? "credit" : "debit";

  const create = useMutation({
    mutationFn: (data: CreateTransactionInput) => transactionsApi.create(data, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      toast.success(t("finans:toast_saved"));
      onClose();
    },
    onError: (err) => setError(handleApiError(err)),
  });

  const onSubmit = (values: PaymentFormValues) => {
    setError("");
    const payload: CreateTransactionInput = {
      kind: values.kind,
      counterparty: values.counterparty,
      amount: toMinor(values.amount),
      currency: values.currency,
      direction: inferredDirection,
      method: values.method,
      notes: values.notes,
    };
    create.mutate(payload);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("finans:dialog_title")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormError>{error}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("finans:dlg_kind")}</Label>
              <select
                {...form.register("kind")}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {TRANSACTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("finans:dlg_party")}</Label>
            <Controller
              name="counterparty.id"
              control={form.control}
              render={({ field }) => (
                <Combobox
                  options={carriersQuery.data?.data ?? []}
                  value={field.value || ""}
                  onChange={field.onChange}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.firstName} ${c.lastName}`}
                  getSearchKeys={(c) => [c.phone]}
                  renderOption={(c) => (
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="truncate font-medium">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {c.phone}
                      </span>
                    </div>
                  )}
                  placeholder={t("select")}
                  aria-invalid={!!form.formState.errors.counterparty?.id}
                />
              )}
            />
            <FieldError>{form.formState.errors.counterparty?.id?.message}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("finans:dlg_amount")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                {...form.register("amount", { valueAsNumber: true })}
              />
              <FieldError>{form.formState.errors.amount?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>{t("cikis:currency")}</Label>
              <select
                {...form.register("currency")}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("finans:dlg_method")}</Label>
            <select
              {...form.register("method")}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {t("finans:dlg_auto_dir")}{" "}
              <span className="font-semibold">
                {inferredDirection === "credit" ? t("finans:dir_credit") : t("finans:dir_debit")}
              </span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("finans:dlg_notes")}</Label>
            <Input {...form.register("notes")} />
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t("save")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
