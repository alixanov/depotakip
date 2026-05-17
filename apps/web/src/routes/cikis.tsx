import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CURRENCIES, type CreateShipmentInput } from "@sadiyakargo/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import { FieldError, FormError } from "@/components/ui/form-error";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { lotsApi } from "@/lib/api/lots";
import { carriersApi } from "@/lib/api/carriers";
import { shipmentsApi } from "@/lib/api/shipments";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireRole } from "@/lib/guards";
import { formatDate, isoDateOnly, toMinor } from "@/lib/format";

/**
 * Form values use *display* units (e.g. 50.00 USD). Conversion to minor units
 * (5000 cents) happens at submit time. This avoids exposing "minör birim"
 * concept to operators and prevents ×100 input errors.
 */
const cikisFormSchema = z.object({
  carrierId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Kargocu seçin"),
  recipient: z
    .object({
      name: z.string().trim().max(120).default(""),
      phone: z.string().trim().max(40).default(""),
      addressTr: z.string().trim().max(500).default(""),
    })
    .optional(),
  shipmentDate: z.string().min(1),
  carrierFee: z.object({
    amount: z.coerce.number().nonnegative("Negatif olamaz"),
    currency: z.enum(CURRENCIES),
  }),
  items: z
    .array(
      z.object({
        lotId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Parti seçin"),
        qty: z.coerce.number().int().positive("Adet > 0"),
        senderChargeAmount: z.coerce.number().nonnegative().optional(),
        senderChargeCurrency: z.enum(CURRENCIES).optional(),
      })
    )
    .min(1, "En az bir mal eklemeli"),
  notes: z.string().trim().max(1000).default(""),
});

type CikisFormValues = z.infer<typeof cikisFormSchema>;

export const Route = createFileRoute("/cikis")({
  beforeLoad: requireRole("admin", "operator"),
  component: CreateShipmentPage,
});

function CreateShipmentPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  // Idempotency-Key: stable for the lifetime of this form. If the user
  // double-submits or TanStack Query retries on network failure, the backend
  // sees the same key and replays the original response instead of creating
  // a duplicate shipment. Rotated after a successful submit (form reuse).
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const carriersQuery = useQuery({
    queryKey: ["carriers", "all"],
    queryFn: () => carriersApi.list({ limit: 200 }),
  });
  const lotsQuery = useQuery({
    queryKey: ["lots", "available"],
    queryFn: () => lotsApi.list({ limit: 200, available: true }),
  });

  const form = useForm<CikisFormValues>({
    resolver: zodResolver(cikisFormSchema),
    defaultValues: {
      carrierId: "",
      recipient: { name: "", phone: "", addressTr: "" },
      shipmentDate: isoDateOnly(),
      carrierFee: { amount: 0, currency: "USD" },
      items: [{ lotId: "", qty: 1, senderChargeAmount: undefined, senderChargeCurrency: "USD" }],
      notes: "",
    },
  });
  const handleApiError = useApiFormErrors(form);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const create = useMutation({
    mutationFn: (data: CreateShipmentInput) => shipmentsApi.create(data, idempotencyKey),
    onSuccess: (shipment) => {
      setIdempotencyKey(crypto.randomUUID()); // next submission gets a fresh key
      toast.success(t("cikis:toast_created", { code: shipment.shortCode }));
      navigate({ to: "/takip" });
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  const onSubmit = (values: CikisFormValues) => {
    setServerError("");
    const payload: CreateShipmentInput = {
      carrierId: values.carrierId,
      recipient: values.recipient?.name
        ? {
            name: values.recipient.name,
            phone: values.recipient.phone,
            addressTr: values.recipient.addressTr,
          }
        : null,
      shipmentDate: values.shipmentDate,
      carrierFee: {
        amount: toMinor(values.carrierFee.amount),
        currency: values.carrierFee.currency,
      },
      items: values.items.map((it) => ({
        lotId: it.lotId,
        qty: it.qty,
        senderCharge:
          it.senderChargeAmount && it.senderChargeAmount > 0
            ? {
                amount: toMinor(it.senderChargeAmount),
                currency: it.senderChargeCurrency ?? "USD",
              }
            : null,
      })),
      notes: values.notes,
    };
    create.mutate(payload);
  };

  const lotLabel = (lotId: string): string => {
    const lot = lotsQuery.data?.data.find((l) => l.id === lotId);
    if (!lot) return "—";
    return t("cikis:items_label_per_lot", {
      qty: lot.qtyAvailable,
      date: formatDate(lot.receivedAt),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cikis:title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormError>{serverError}</FormError>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("cikis:carrier")}</Label>
              <Controller
                name="carrierId"
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
                    aria-invalid={!!form.formState.errors.carrierId}
                  />
                )}
              />
              <FieldError>{form.formState.errors.carrierId?.message}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label>{t("cikis:shipmentDate")}</Label>
              <Controller
                name="shipmentDate"
                control={form.control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? isoDateOnly())}
                  />
                )}
              />
            </div>
          </div>

          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("cikis:recipient_legend")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t("cikis:recipient_name")}</Label>
                <Input {...form.register("recipient.name")} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("cikis:recipient_phone")}</Label>
                <Input
                  {...form.register("recipient.phone")}
                  placeholder="+90..."
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("cikis:recipient_addressTr")}</Label>
                <Input {...form.register("recipient.addressTr")} autoComplete="street-address" />
              </div>
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("cikis:items_label")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    lotId: "",
                    qty: 1,
                    senderChargeAmount: undefined,
                    senderChargeCurrency: "USD",
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                {t("cikis:items_add")}
              </Button>
            </div>
            {fields.map((field, idx) => {
              // Look up the selected lot so we can surface its remaining qty
              // as a hint and clamp the NumberInput before the server sees
              // an over-allocation (saves a 409 round-trip).
              const lotId = form.watch(`items.${idx}.lotId`);
              const lot = lotId ? lotsQuery.data?.data.find((l) => l.id === lotId) : undefined;
              const qty = form.watch(`items.${idx}.qty`) ?? 0;
              const overAvailable = !!lot && qty > lot.qtyAvailable;
              return (
                <div key={field.id} className="rounded-md border p-3">
                  <div className="grid grid-cols-[1fr_120px_40px] items-start gap-2">
                    <div>
                      <Controller
                        name={`items.${idx}.lotId`}
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            options={lotsQuery.data?.data ?? []}
                            value={field.value || ""}
                            onChange={field.onChange}
                            getValue={(l) => l.id}
                            // Visible label = id suffix + short context; full search keys add date.
                            getLabel={(l) => `#${l.id.slice(-6)}`}
                            getSearchKeys={(l) => [
                              formatDate(l.receivedAt),
                              String(l.qtyAvailable),
                            ]}
                            renderOption={(l) => (
                              <div className="flex min-w-0 items-baseline justify-between gap-2">
                                <span className="truncate">
                                  <span className="font-mono text-xs text-muted-foreground">
                                    #{l.id.slice(-6)}
                                  </span>{" "}
                                  <span className="font-medium">
                                    {l.qtyAvailable} {t("depo:form_qty").toLowerCase()}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {formatDate(l.receivedAt)}
                                </span>
                              </div>
                            )}
                            renderSelected={(l) => (
                              <span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{l.id.slice(-6)}
                                </span>{" "}
                                — {lotLabel(l.id)}
                              </span>
                            )}
                            placeholder={t("cikis:items_select")}
                            aria-invalid={!!form.formState.errors.items?.[idx]?.lotId}
                          />
                        )}
                      />
                      <FieldError>{form.formState.errors.items?.[idx]?.lotId?.message}</FieldError>
                    </div>
                    <div>
                      <Controller
                        name={`items.${idx}.qty`}
                        control={form.control}
                        render={({ field }) => (
                          <NumberInput
                            value={field.value}
                            onChange={field.onChange}
                            min={1}
                            max={lot?.qtyAvailable}
                            aria-label={t("depo:form_qty")}
                            aria-invalid={overAvailable}
                          />
                        )}
                      />
                      {lot && (
                        <p
                          className={
                            overAvailable
                              ? "mt-0.5 text-[11px] font-semibold text-destructive"
                              : "mt-0.5 text-[11px] text-muted-foreground"
                          }
                        >
                          {overAvailable
                            ? t("cikis:over_available", { max: lot.qtyAvailable })
                            : t("cikis:max_available", { max: lot.qtyAvailable })}
                        </p>
                      )}
                      <FieldError>{form.formState.errors.items?.[idx]?.qty?.message}</FieldError>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length === 1}
                      onClick={() => remove(idx)}
                      aria-label={t("cikis:items_remove")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_120px_40px] gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        {t("cikis:sender_charge")}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        {...form.register(`items.${idx}.senderChargeAmount`, {
                          setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        {t("cikis:currency")}
                      </Label>
                      <select
                        {...form.register(`items.${idx}.senderChargeCurrency`)}
                        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div />
                  </div>
                </div>
              );
            })}
            <FieldError>
              {typeof form.formState.errors.items?.message === "string"
                ? form.formState.errors.items.message
                : undefined}
            </FieldError>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("cikis:carrier_fee")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                {...form.register("carrierFee.amount", { valueAsNumber: true })}
              />
              <FieldError>{form.formState.errors.carrierFee?.amount?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>{t("cikis:currency_label")}</Label>
              <select
                {...form.register("carrierFee.currency")}
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
            <Label>{t("cikis:notes")}</Label>
            <Input {...form.register("notes")} />
          </div>

          <StickySubmitBar form={form} isSubmitting={form.formState.isSubmitting} />
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Sticky bottom bar that summarises the shipment in real time (item count,
 * total qty, carrier fee) and hosts the primary submit. Floats above the
 * mobile bottom-nav (`bottom-16`) and sits at the viewport bottom on desktop.
 */
function StickySubmitBar({
  form,
  isSubmitting,
}: {
  form: ReturnType<typeof useForm<CikisFormValues>>;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();
  const items = form.watch("items");
  const carrierFee = form.watch("carrierFee");
  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const itemsCount = items.filter((it) => it.lotId).length;
  const errorCount = countFormErrors(form.formState.errors);

  return (
    <div className="sticky bottom-16 z-30 -mx-6 mt-4 border-t bg-card/95 px-6 py-3 backdrop-blur md:bottom-0 md:-mx-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("cikis:summary_items")}</dt>
            <dd className="font-semibold tabular-nums">{itemsCount}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("cikis:summary_qty")}</dt>
            <dd className="font-semibold tabular-nums">{totalQty}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("cikis:summary_fee")}</dt>
            <dd className="font-semibold tabular-nums">
              {(carrierFee?.amount || 0).toLocaleString()} {carrierFee?.currency || "USD"}
            </dd>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-destructive">
              <span className="font-semibold">{t("cikis:summary_errors", { n: errorCount })}</span>
            </div>
          )}
        </dl>
        <Button type="submit" loading={isSubmitting} variant="brand">
          {t("cikis:submit")}
        </Button>
      </div>
    </div>
  );
}

/** Count leaf errors anywhere in the form state tree. */
function countFormErrors(errors: unknown): number {
  if (!errors || typeof errors !== "object") return 0;
  let n = 0;
  for (const v of Object.values(errors as Record<string, unknown>)) {
    if (!v) continue;
    if (
      typeof v === "object" &&
      "message" in (v as object) &&
      (v as { message?: unknown }).message
    ) {
      n += 1;
    } else if (typeof v === "object") {
      n += countFormErrors(v);
    }
  }
  return n;
}
