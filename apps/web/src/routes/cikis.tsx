import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CURRENCIES, type CreateShipmentInput } from "@sadiyakargo/shared";
import { ChevronDown, ImageIcon, Plus, Trash2, UserPlus } from "lucide-react";
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
import { sendersApi } from "@/lib/api/senders";
import { shipmentsApi } from "@/lib/api/shipments";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireRole } from "@/lib/guards";
import { formatDate, formatMoneyObject, isoDateOnly, toMinor } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  // Senders are loaded just to resolve the lot.senderId → fullName mapping
  // shown in the lot-picker combobox option.
  const sendersQuery = useQuery({
    queryKey: ["senders", "all"],
    queryFn: () => sendersApi.list({ limit: 200 }),
  });
  const senderName = (id: string) =>
    sendersQuery.data?.data.find((s) => s.id === id)?.fullName ?? "—";

  const form = useForm<CikisFormValues>({
    resolver: zodResolver(cikisFormSchema),
    defaultValues: {
      carrierId: "",
      recipient: { name: "", phone: "", addressTr: "" },
      shipmentDate: isoDateOnly(),
      carrierFee: { amount: 0, currency: "USD" },
      items: [{ lotId: "", qty: 1 }],
      notes: "",
    },
  });
  const handleApiError = useApiFormErrors(form);

  // Recipient is optional. Hide the three input fields by default; only
  // expand them when the operator clicks "Add recipient" (or when the form
  // already contains a value — e.g. after re-opening for editing).
  const [recipientOpen, setRecipientOpen] = useState<boolean>(
    () => !!form.getValues("recipient.name")
  );

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
      })),
      notes: values.notes,
    };
    create.mutate(payload);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cikis:title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* pb-24 on mobile reserves space for the sticky submit bar at bottom-16
            (above the bottom-nav). Without it, the last field is permanently
            occluded when the form is short. */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-24 md:pb-4">
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

          {/* Recipient (optional) — collapsed by default because most shipments
              go to a repeat carrier route and the fields are noise. The toggle
              row keeps the section discoverable without occupying real-estate. */}
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setRecipientOpen((v) => !v)}
              aria-expanded={recipientOpen}
              aria-controls="recipient-fields"
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left",
                "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                "transition-colors hover:bg-muted/50",
                recipientOpen && "border-b"
              )}
            >
              <span className="flex items-center gap-2">
                {recipientOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {t("cikis:recipient_legend")}
              </span>
              {!recipientOpen && (
                <span className="font-normal normal-case text-muted-foreground/70">
                  {t("cikis:recipient_add_hint")}
                </span>
              )}
            </button>
            {recipientOpen && (
              <div id="recipient-fields" className="grid gap-3 p-3 sm:grid-cols-3">
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
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("cikis:items_label")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ lotId: "", qty: 1 })}
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
                  {/* Mobile (< sm): lot + qty stack vertically with delete at top-right.
                      Desktop: 3-col grid stays as before. The min-w-0 wrapper
                      keeps the Combobox from forcing horizontal scroll on 375. */}
                  <div className="grid grid-cols-[1fr_44px] items-start gap-2 sm:grid-cols-[1fr_120px_40px]">
                    <div className="min-w-0">
                      <Controller
                        name={`items.${idx}.lotId`}
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            options={lotsQuery.data?.data ?? []}
                            value={field.value || ""}
                            onChange={field.onChange}
                            getValue={(l) => l.id}
                            // Visible label prefers the human label; falls back to id suffix.
                            getLabel={(l) => l.label || `#${l.id.slice(-6)}`}
                            getSearchKeys={(l) => [
                              l.label,
                              senderName(l.senderId),
                              formatDate(l.receivedAt),
                              String(l.qtyAvailable),
                            ]}
                            renderOption={(l) => (
                              // Row layout: 36px thumbnail · label+sender (flex-1)
                              // · price · qty · date. On narrow viewports the
                              // meta column wraps under the label.
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                                  {l.firstPhotoUrl ? (
                                    <img
                                      src={l.firstPhotoUrl}
                                      alt=""
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon
                                      className="h-4 w-4 text-muted-foreground/60"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {l.label || (
                                        <span className="font-mono text-muted-foreground">
                                          #{l.id.slice(-6)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {senderName(l.senderId)} · {formatDate(l.receivedAt)}
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end text-xs">
                                  {l.unitPrice ? (
                                    <span className="tabular-nums">
                                      {formatMoneyObject(l.unitPrice)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                  <span className="tabular-nums text-muted-foreground">
                                    {l.qtyAvailable} {t("depo:form_qty").toLowerCase()}
                                  </span>
                                </div>
                              </div>
                            )}
                            renderSelected={(l) => (
                              <span className="flex min-w-0 items-center gap-2">
                                {l.firstPhotoUrl && (
                                  <img
                                    src={l.firstPhotoUrl}
                                    alt=""
                                    loading="lazy"
                                    className="h-5 w-5 shrink-0 rounded object-cover"
                                  />
                                )}
                                <span className="truncate">
                                  {l.label || `#${l.id.slice(-6)}`}{" "}
                                  <span className="text-muted-foreground">
                                    · {senderName(l.senderId)} · {l.qtyAvailable}{" "}
                                    {t("depo:form_qty").toLowerCase()}
                                  </span>
                                </span>
                              </span>
                            )}
                            placeholder={t("cikis:items_select")}
                            aria-invalid={!!form.formState.errors.items?.[idx]?.lotId}
                          />
                        )}
                      />
                      <FieldError>{form.formState.errors.items?.[idx]?.lotId?.message}</FieldError>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length === 1}
                      onClick={() => remove(idx)}
                      aria-label={t("cikis:items_remove")}
                      className="sm:order-3"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
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
