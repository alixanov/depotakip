import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
  /** Called after a successful POST /carriers — lets callers auto-select the
   *  freshly-created carrier (e.g. inline creation from the Shipment form). */
  onCreated?: (carrier: Carrier) => void;
}

/** Reusable "new carrier" dialog. Lives outside admin.carriers.tsx so the
 *  Shipment-create flow can drop it in next to the carrier Combobox — same
 *  pattern as SenderFormDialog. */
export function CarrierFormDialog({ open, onOpenChange, onCreated }: CarrierFormDialogProps) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const form = useForm<CreateCarrierInput>({
    resolver: zodResolver(createCarrierSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      deliveryAddressTr: "",
      notes: "",
    },
  });
  const handleApiError = useApiFormErrors(form);

  // Clear stale state on every re-open so a previous failed attempt doesn't
  // pre-fill the inputs the next time the operator opens the dialog.
  useEffect(() => {
    if (open) {
      setServerError("");
      form.reset();
    }
  }, [open, form]);

  const create = useMutation({
    mutationFn: (data: CreateCarrierInput) => carriersApi.create(data),
    onSuccess: (carrier) => {
      qc.invalidateQueries({ queryKey: ["carriers"] });
      onCreated?.(carrier);
      onOpenChange(false);
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:btn_new_carrier")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            create.mutate(d);
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
          <div className="space-y-1.5">
            <Label>{t("admin:col_notes")}</Label>
            <Input {...form.register("notes")} />
          </div>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
