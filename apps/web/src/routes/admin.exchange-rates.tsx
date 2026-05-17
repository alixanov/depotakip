import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  CURRENCIES,
  createExchangeRateSchema,
  type CreateExchangeRateInput,
  type Currency,
  type ExchangeRate,
} from "@depotakip/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldError, FormError } from "@/components/ui/form-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Coins } from "lucide-react";
import { exchangeRatesApi } from "@/lib/api/exchangeRates";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requireRole } from "@/lib/guards";

export const Route = createFileRoute("/admin/exchange-rates")({
  beforeLoad: requireRole("admin"),
  component: ExchangeRatesPage,
});

type NonBaseCurrency = Exclude<Currency, "USD">;
const NON_BASE_CURRENCIES = CURRENCIES.filter((c) => c !== "USD") as NonBaseCurrency[];

function ExchangeRatesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: () => exchangeRatesApi.list(),
  });

  const deleteWithUndo = useUndoableDelete({
    queryKey: ["exchange-rates"],
    deleteFn: (id) => exchangeRatesApi.remove(id),
    toastTitle: t("admin:rates_title") + " — " + t("delete"),
  });

  const columns: Column<ExchangeRate>[] = [
    { key: "date", header: t("date"), cell: (r) => r.rateDate },
    {
      key: "ccy",
      header: t("admin:col_currency"),
      cell: (r) => <span className="font-semibold">{r.currency}</span>,
    },
    {
      key: "rate",
      header: t("admin:col_rate"),
      cell: (r) => <code className="tabular-nums">{r.rateToUsd}</code>,
    },
    { key: "src", header: t("admin:col_source"), cell: (r) => r.source },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirmId(r.id)}
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
      width: "60px",
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("admin:rates_title")}</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t("admin:btn_new_rate")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<Coins />}
                title={t("admin:no_rates_yet")}
                action={
                  <Button onClick={() => setDialogOpen(true)} variant="brand" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t("admin:btn_new_rate")}
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      <CreateRateDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t("admin:rate_delete_title")}
        destructive
        onConfirm={() => {
          if (confirmId) {
            deleteWithUndo(confirmId);
            setConfirmId(null);
          }
        }}
      />
    </div>
  );
}

function CreateRateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const form = useForm<{ currency: NonBaseCurrency; rateToUsd: number; rateDate: string }>({
    resolver: zodResolver(createExchangeRateSchema) as never,
    defaultValues: {
      currency: NON_BASE_CURRENCIES[0],
      rateToUsd: 0,
      rateDate: new Date().toISOString().slice(0, 10),
    },
  });
  const handleApiError = useApiFormErrors(form);

  const create = useMutation({
    mutationFn: (data: CreateExchangeRateInput) => exchangeRatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:btn_new_rate")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            create.mutate(d as CreateExchangeRateInput);
          })}
          className="space-y-3"
        >
          <FormError>{serverError}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin:rate_currency")}</Label>
              <select
                {...form.register("currency")}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {NON_BASE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:rate_date")}</Label>
              <Input type="date" {...form.register("rateDate")} />
              <FieldError>{form.formState.errors.rateDate?.message}</FieldError>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:rate_value")}</Label>
            <Input
              type="number"
              step="0.00000001"
              {...form.register("rateToUsd", { valueAsNumber: true })}
            />
            <FieldError>{form.formState.errors.rateToUsd?.message}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t("save")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
