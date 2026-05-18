import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  TRANSACTION_KINDS,
  type Carrier,
  type CreateTransactionInput,
  type Sender,
  type Transaction,
  type TransactionKind,
} from "@sadiyakargo/shared";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Download,
  Receipt,
  Wallet,
  Plus,
  Truck,
  Users as UsersIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-picker";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { FieldError, FormError } from "@/components/ui/form-error";
import { toast } from "sonner";
import { downloadPaymentReceipt, transactionsApi } from "@/lib/api/transactions";
import { carriersApi } from "@/lib/api/carriers";
import { sendersApi } from "@/lib/api/senders";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireAuth } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { formatMoney, formatUsdCents, toMinor, useFormatters } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────
// Form schemas + types
// ────────────────────────────────────────────────────────────────────────────

const paymentFormSchema = z.object({
  kind: z.enum(TRANSACTION_KINDS),
  counterparty: z.object({
    type: z.enum(["carrier", "sender"]),
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "validation:counterparty_required"),
  }),
  amount: z.coerce.number().positive("validation:amount_positive"),
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
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  partyType: z.enum(["carrier", "sender"]).optional().catch(undefined),
  partyId: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/finans")({
  beforeLoad: requireAuth,
  validateSearch: (s) => finansSearchSchema.parse(s),
  component: FinansPage,
});

// ────────────────────────────────────────────────────────────────────────────
// Transaction-kind visual identity. Resolves a kind to icon + tone class for
// pill, used by both the table cell and the payment dialog selector.
// ────────────────────────────────────────────────────────────────────────────

interface KindMeta {
  Icon: typeof ArrowUpRight;
  /** Background + text colour pair used by the pill. */
  pillCls: string;
  /** Optional small-icon background for the row-leading marker. */
  dotCls: string;
}

const KIND_META: Record<TransactionKind, KindMeta> = {
  carrier_charge: {
    Icon: ArrowUpRight,
    pillCls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    dotCls: "bg-amber-500",
  },
  sender_charge: {
    Icon: ArrowUpRight,
    pillCls: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
    dotCls: "bg-orange-500",
  },
  carrier_payment: {
    Icon: ArrowDownLeft,
    pillCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    dotCls: "bg-emerald-500",
  },
  sender_payment: {
    Icon: ArrowDownLeft,
    pillCls: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
    dotCls: "bg-teal-500",
  },
  adjustment: {
    Icon: Receipt,
    pillCls: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    dotCls: "bg-violet-500",
  },
};

function FinansPage() {
  const canMutate = useAuthStore((s) => !!s.user?.role.permissions.includes("transactions:write"));
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "balances";
  const setTab = (next: string) =>
    navigate({
      search: (s) => ({ ...s, tab: next === "balances" ? undefined : (next as Tab) }),
    });
  const { t } = useTranslation();

  const TabIcon: Record<Tab, typeof Wallet> = {
    balances: Wallet,
    tx: Receipt,
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
            {tab === "balances" ? t("finans:tab_balances") : t("finans:tab_tx")}
          </span>
        }
        subtitle={t(tab === "balances" ? "finans:subtitle_balances" : "finans:subtitle_tx")}
        actions={canMutate ? <PaymentDialogTrigger /> : null}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="balances">
            <Wallet className="h-3.5 w-3.5" />
            {t("finans:tab_balances")}
          </TabsTrigger>
          <TabsTrigger value="tx">
            <Receipt className="h-3.5 w-3.5" />
            {t("finans:tab_tx")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <BalancesTab />
        </TabsContent>
        <TabsContent value="tx">
          <TxTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Balances tab — 2-card grid, each row with Avatar + name + signed pill.
// ────────────────────────────────────────────────────────────────────────────

interface BalanceRow {
  counterpartyId: string;
  name: string;
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
}

function BalancesTab() {
  const { t } = useTranslation();
  const carriersQuery = useQuery({
    queryKey: ["balances", "carriers"],
    queryFn: transactionsApi.carrierBalances,
  });
  const sendersQuery = useQuery({
    queryKey: ["balances", "senders"],
    queryFn: transactionsApi.senderBalances,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BalanceCard
        title={t("finans:balances_carriers")}
        rows={carriersQuery.data}
        loading={carriersQuery.isLoading}
        error={carriersQuery.error as Error | null}
        icon={<Truck className="h-4 w-4" />}
      />
      <BalanceCard
        title={t("finans:balances_senders")}
        rows={sendersQuery.data}
        loading={sendersQuery.isLoading}
        error={sendersQuery.error as Error | null}
        icon={<UsersIcon className="h-4 w-4" />}
      />
    </div>
  );
}

function BalanceCard({
  title,
  rows,
  loading,
  error,
  icon,
}: {
  title: string;
  rows: BalanceRow[] | undefined;
  loading: boolean;
  error: Error | null;
  icon: React.ReactNode;
}) {
  const { t } = useTranslation();
  const total = useMemo(() => (rows ?? []).reduce((acc, r) => acc + r.balanceUsd, 0), [rows]);

  return (
    <Card>
      <CardContent className="p-0">
        <header className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
              {icon}
            </span>
            {title}
          </div>
          <BalancePill usdCents={total} size="md" />
        </header>

        {loading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {error && <p className="p-4 text-sm text-destructive">{error.message}</p>}
        {rows && rows.length === 0 && (
          <EmptyState icon={<Wallet />} title={t("finans:balances_empty")} />
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y">
            {rows.map((r) => (
              <li
                key={r.counterpartyId}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <Avatar name={r.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("finans:balances_debit_credit", {
                      debit: formatUsdCents(r.debitUsd),
                      credit: formatUsdCents(r.creditUsd),
                    })}
                  </p>
                </div>
                <BalancePill usdCents={r.balanceUsd} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Signed-amount pill used by every balance row + the totals header. */
function BalancePill({ usdCents, size = "sm" }: { usdCents: number; size?: "sm" | "md" }) {
  const tone = usdCents > 0 ? "owed" : usdCents < 0 ? "overpaid" : "settled";
  const cls =
    tone === "owed"
      ? "text-amber-700 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40"
      : tone === "overpaid"
        ? "text-violet-700 bg-violet-50 dark:text-violet-200 dark:bg-violet-950/40"
        : "text-emerald-700 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950/40";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold tabular-nums",
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-sm",
        cls
      )}
    >
      {formatUsdCents(usdCents)}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Transactions tab
// ────────────────────────────────────────────────────────────────────────────

function TxTab() {
  const { t } = useTranslation();
  const { formatDate: fmtDate } = useFormatters();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const page = search.page ?? 1;
  const kindFilter: TransactionKind | "" = search.kind ?? "";
  const range = { from: search.from, to: search.to };

  const setPage = (p: number) =>
    navigate({ search: (s) => ({ ...s, page: p === 1 ? undefined : p }) });
  const setKindFilter = (kind: TransactionKind | "") =>
    navigate({ search: (s) => ({ ...s, page: undefined, kind: kind || undefined }) });
  const setRange = (next: { from?: string; to?: string }) =>
    navigate({
      search: (s) => ({
        ...s,
        page: undefined,
        from: next.from || undefined,
        to: next.to || undefined,
      }),
    });

  // Counterparty rosters — needed to resolve counterparty.id → name.
  // Fetch once, share across rows + the filter combobox.
  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 500 }),
  });
  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 500 }),
  });

  const carrierById = useMemo(() => {
    const m = new Map<string, Carrier>();
    for (const c of carriersQuery.data?.data ?? []) m.set(c.id, c);
    return m;
  }, [carriersQuery.data]);
  const senderById = useMemo(() => {
    const m = new Map<string, Sender>();
    for (const s of sendersQuery.data?.data ?? []) m.set(s.id, s);
    return m;
  }, [sendersQuery.data]);

  const query = useQuery({
    queryKey: ["transactions", { page, kindFilter, range }],
    queryFn: () =>
      transactionsApi.list({
        page,
        limit: 25,
        kind: kindFilter || undefined,
        from: range.from,
        to: range.to,
      }),
  });

  const counterpartyName = (tx: Transaction): string => {
    if (tx.counterparty.type === "carrier") {
      const c = carrierById.get(tx.counterparty.id);
      return c ? `${c.firstName} ${c.lastName}`.trim() : t("finans:no_party");
    }
    const s = senderById.get(tx.counterparty.id);
    return s ? s.fullName : t("finans:no_party");
  };

  const counterpartyPhone = (tx: Transaction): string | undefined => {
    if (tx.counterparty.type === "carrier") return carrierById.get(tx.counterparty.id)?.phone;
    return senderById.get(tx.counterparty.id)?.phone;
  };

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);

  // Totals across the visible page (USD-cents). We sum amountUsdSnapshot from
  // the transaction itself so multi-currency rows roll up cleanly.
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, tx) => ({
        debit: acc.debit + (tx.direction === "debit" ? tx.amountUsdSnapshot : 0),
        credit: acc.credit + (tx.direction === "credit" ? tx.amountUsdSnapshot : 0),
      }),
      { debit: 0, credit: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-3">
      {/* Toolbar: kind chips + date range */}
      <div className="flex flex-wrap items-center gap-2">
        <KindFilter value={kindFilter} onChange={setKindFilter} />
        <div className="ml-auto">
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </div>

      {/* Header strip with count + totals */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="primary" size="lg">
          <Receipt className="h-3 w-3" />
          {t("finans:tx_count", { n: rows.length })}
        </Badge>
        {rows.length > 0 && (
          <>
            <SummaryChip
              label={t("finans:totals_debit")}
              value={formatUsdCents(totals.debit)}
              tone="amber"
              icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            />
            <SummaryChip
              label={t("finans:totals_credit")}
              value={formatUsdCents(totals.credit)}
              tone="emerald"
              icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
            />
          </>
        )}
      </div>

      {query.isLoading && (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )}
      {query.error && <p className="text-sm text-destructive">{(query.error as Error).message}</p>}
      {!query.isLoading && rows.length === 0 && (
        <Card>
          <EmptyState icon={<Banknote />} title={t("finans:tx_empty")} />
        </Card>
      )}

      {rows.length > 0 && (
        <>
          {/* Mobile card list */}
          <ul className="space-y-2 md:hidden">
            {rows.map((tx) => (
              <TxCard
                key={tx.id}
                tx={tx}
                counterpartyName={counterpartyName(tx)}
                counterpartyPhone={counterpartyPhone(tx)}
              />
            ))}
          </ul>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card/85 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/65">
                    <tr className="border-b">
                      <th className="p-3" style={{ width: "120px" }}>
                        {t("finans:tx_col_date")}
                      </th>
                      <th className="p-3">{t("finans:tx_col_kind")}</th>
                      <th className="p-3">{t("finans:tx_col_party")}</th>
                      <th className="p-3 text-right" style={{ width: "150px" }}>
                        {t("finans:tx_col_amount")}
                      </th>
                      <th className="p-3" style={{ width: "60px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((tx) => {
                      const meta = KIND_META[tx.kind];
                      const name = counterpartyName(tx);
                      const phone = counterpartyPhone(tx);
                      return (
                        <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="p-3 align-middle whitespace-nowrap text-muted-foreground">
                            {fmtDate(tx.txDate)}
                          </td>
                          <td className="p-3 align-middle">
                            <KindPill kind={tx.kind} />
                          </td>
                          <td className="p-3 align-middle">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={name} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {tx.counterparty.type === "carrier"
                                    ? t("finans:party_carrier")
                                    : t("finans:party_sender")}
                                  {phone ? ` · ${phone}` : ""}
                                  {tx.shipmentId
                                    ? ` · ${t("finans:tx_for_shipment")} #${tx.shipmentId.slice(-6)}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-middle text-right">
                            <AmountCell tx={tx} colour={meta.dotCls} />
                          </td>
                          <td className="p-3 align-middle text-right">
                            <Tooltip content={t("finans:receipt_pdf_aria")}>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => downloadPaymentReceipt(tx.id)}
                                aria-label={t("finans:receipt_pdf_aria")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {query.data && query.data.pagination.total > query.data.pagination.limit && (
            <PaginationStrip
              page={query.data.pagination.page}
              total={query.data.pagination.total}
              limit={query.data.pagination.limit}
              hasMore={query.data.pagination.hasMore}
              onChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function PaginationStrip({
  page,
  total,
  limit,
  hasMore,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {total} · {page}/{totalPages}
      </span>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ‹
        </Button>
        <Button variant="ghost" size="sm" disabled={!hasMore} onClick={() => onChange(page + 1)}>
          ›
        </Button>
      </div>
    </div>
  );
}

function TxCard({
  tx,
  counterpartyName,
  counterpartyPhone,
}: {
  tx: Transaction;
  counterpartyName: string;
  counterpartyPhone?: string;
}) {
  const { t } = useTranslation();
  const { formatDate: fmtDate } = useFormatters();
  const meta = KIND_META[tx.kind];
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <Avatar name={counterpartyName} size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{counterpartyName}</p>
            <AmountCell tx={tx} colour={meta.dotCls} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <KindPill kind={tx.kind} compact />
            <span>·</span>
            <span>{fmtDate(tx.txDate)}</span>
            {counterpartyPhone && (
              <>
                <span>·</span>
                <span>{counterpartyPhone}</span>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => downloadPaymentReceipt(tx.id)}
          aria-label={t("finans:receipt_pdf_aria")}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function KindPill({ kind, compact }: { kind: TransactionKind; compact?: boolean }) {
  const { t } = useTranslation();
  const meta = KIND_META[kind];
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        compact ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
        meta.pillCls
      )}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.4} />
      {t(`finans:kind_${kind}`)}
    </span>
  );
}

function AmountCell({ tx, colour }: { tx: Transaction; colour: string }) {
  const { t } = useTranslation();
  const sign = tx.direction === "credit" ? "+" : "−";
  const dirLabel =
    tx.direction === "credit" ? t("finans:dir_credit_full") : t("finans:dir_debit_full");
  return (
    <div className="flex flex-col items-end leading-tight">
      <span
        className={cn(
          "inline-flex items-baseline gap-1 text-sm font-bold tabular-nums",
          tx.direction === "credit"
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-amber-700 dark:text-amber-300"
        )}
      >
        <span>{sign}</span>
        <span>{formatMoney(tx.amount, tx.currency)}</span>
      </span>
      <span
        className={cn(
          "mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        )}
      >
        <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", colour)} />
        {dirLabel}
      </span>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "amber" | "emerald";
  icon: React.ReactNode;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold",
        cls
      )}
    >
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function KindFilter({
  value,
  onChange,
}: {
  value: TransactionKind | "";
  onChange: (v: TransactionKind | "") => void;
}) {
  const { t } = useTranslation();
  const items: ({ kind: TransactionKind | ""; label: string } | "sep")[] = [
    { kind: "", label: t("finans:filter_all_kinds") },
    { kind: "carrier_charge", label: t("finans:kind_carrier_charge") },
    { kind: "carrier_payment", label: t("finans:kind_carrier_payment") },
    { kind: "sender_charge", label: t("finans:kind_sender_charge") },
    { kind: "sender_payment", label: t("finans:kind_sender_payment") },
    { kind: "adjustment", label: t("finans:kind_adjustment") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist">
      {items.map((it) => {
        if (it === "sep") return null;
        const active = value === it.kind;
        const meta = it.kind ? KIND_META[it.kind] : null;
        return (
          <button
            key={it.kind || "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.kind)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary-soft text-primary-soft-foreground"
                : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {meta && (
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", meta.dotCls)} />
            )}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Payment dialog (mostly preserved from the prior version, theme-tightened)
// ────────────────────────────────────────────────────────────────────────────

function PaymentDialogTrigger() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="brand">
        <Plus className="h-4 w-4" />
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
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());
  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 500 }),
  });
  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 500 }),
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

  const counterpartyType = form.watch("counterparty.type");
  const kind = form.watch("kind");
  const inferredDirection: "debit" | "credit" =
    kind === "carrier_payment" || kind === "sender_payment" ? "credit" : "debit";

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
          <ResponsiveDialogTitle>
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Banknote className="h-4 w-4" />
              </span>
              {t("finans:dialog_title")}
            </span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormError>{error}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("finans:dlg_kind")}</Label>
              <select
                {...form.register("kind")}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft"
              >
                {TRANSACTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`finans:kind_${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("finans:dlg_party_type")}</Label>
              <select
                {...form.register("counterparty.type")}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft"
              >
                <option value="carrier">{t("finans:party_carrier")}</option>
                <option value="sender">{t("finans:party_sender")}</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("finans:dlg_party")}</Label>
            <Controller
              name="counterparty.id"
              control={form.control}
              render={({ field }) =>
                counterpartyType === "carrier" ? (
                  <Combobox
                    options={carriersQuery.data?.data ?? []}
                    value={field.value || ""}
                    onChange={field.onChange}
                    getValue={(c) => c.id}
                    getLabel={(c) => `${c.firstName} ${c.lastName}`.trim()}
                    getSearchKeys={(c) => [c.phone]}
                    renderOption={(c) => (
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {`${c.firstName} ${c.lastName}`.trim()}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {c.phone}
                        </span>
                      </div>
                    )}
                    placeholder={t("select")}
                    aria-invalid={!!form.formState.errors.counterparty?.id}
                  />
                ) : (
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
                    aria-invalid={!!form.formState.errors.counterparty?.id}
                  />
                )
              }
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
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft"
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
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft"
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
            <Button type="submit" variant="brand" loading={create.isPending}>
              {t("save")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
