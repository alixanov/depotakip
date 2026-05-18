import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createCarrierSchema, type Carrier, type CreateCarrierInput } from "@sadiyakargo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { FieldError, FormError } from "@/components/ui/form-error";
import { carriersApi } from "@/lib/api/carriers";
import { useApiFormErrors } from "@/lib/useApiFormErrors";

interface CarrierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided — edit mode (PATCH /carriers/:id); when undefined — create mode. */
  carrier?: Carrier;
  /** Fires after a successful create or update. Receives the saved carrier so
   *  callers can auto-select it (e.g. inline creation from the Shipment form). */
  onSaved?: (carrier: Carrier) => void;
}

const EMPTY: CreateCarrierInput = {
  firstName: "",
  lastName: "",
  phone: "",
  deliveryAddressTr: "",
  notes: "",
  telegramChatId: null,
  telegramUsername: null,
};

/** Reusable carrier dialog supporting both create and edit. Lives outside
 *  admin.carriers.tsx so the Shipment-create flow can drop it in next to the
 *  carrier Combobox (always in create mode there) — same pattern as
 *  SenderFormDialog. */
export function CarrierFormDialog({
  open,
  onOpenChange,
  carrier,
  onSaved,
}: CarrierFormDialogProps) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const isEdit = !!carrier;
  const form = useForm<CreateCarrierInput>({
    resolver: zodResolver(createCarrierSchema),
    defaultValues: EMPTY,
  });
  const handleApiError = useApiFormErrors(form);

  // Reset on every open so previous attempts or previously-edited rows don't
  // bleed into the next session.
  useEffect(() => {
    if (!open) return;
    setServerError("");
    form.reset(
      carrier
        ? {
            firstName: carrier.firstName,
            lastName: carrier.lastName,
            phone: carrier.phone,
            deliveryAddressTr: carrier.deliveryAddressTr ?? "",
            notes: carrier.notes ?? "",
            telegramChatId: carrier.telegramChatId,
            telegramUsername: carrier.telegramUsername,
          }
        : EMPTY
    );
  }, [open, carrier, form]);

  const onSuccess = (saved: Carrier) => {
    qc.invalidateQueries({ queryKey: ["carriers"] });
    onSaved?.(saved);
    onOpenChange(false);
  };
  const onError = (err: unknown) => setServerError(handleApiError(err));

  const create = useMutation({
    mutationFn: (data: CreateCarrierInput) => carriersApi.create(data),
    onSuccess,
    onError,
  });
  const update = useMutation({
    mutationFn: (data: CreateCarrierInput) => carriersApi.update(carrier!.id, data),
    onSuccess,
    onError,
  });
  const mutation = isEdit ? update : create;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit
              ? t("admin:btn_edit_carrier", {
                  name: `${carrier!.firstName} ${carrier!.lastName}`,
                })
              : t("admin:btn_new_carrier")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            mutation.mutate(d);
          })}
          className="space-y-3"
        >
          <FormError>{serverError}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin:col_first_name")}</Label>
              <Input {...form.register("firstName")} autoFocus autoComplete="given-name" />
              <FieldError>{form.formState.errors.firstName?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:col_last_name")}</Label>
              <Input {...form.register("lastName")} autoComplete="family-name" />
              <FieldError>{form.formState.errors.lastName?.message}</FieldError>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_phone")}</Label>
            <Input {...form.register("phone")} placeholder="+90..." autoComplete="tel" />
            <FieldError>{form.formState.errors.phone?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_addr_delivery")}</Label>
            <Input {...form.register("deliveryAddressTr")} autoComplete="street-address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin:col_tg_username")}</Label>
              <Controller
                control={form.control}
                name="telegramUsername"
                render={({ field }) => (
                  <Input
                    placeholder="@sadiyakargo"
                    autoComplete="off"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">{t("admin:tg_username_hint")}</p>
              <FieldError>{form.formState.errors.telegramUsername?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:col_tg_chat_id")}</Label>
              <Controller
                control={form.control}
                name="telegramChatId"
                render={({ field }) => (
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="123456789"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">{t("admin:tg_chat_id_hint")}</p>
              <FieldError>{form.formState.errors.telegramChatId?.message}</FieldError>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_notes")}</Label>
            <Input {...form.register("notes")} />
          </div>
          <Button type="submit" className="w-full" loading={mutation.isPending}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
