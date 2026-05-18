import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createSenderSchema, type CreateSenderInput, type Sender } from "@sadiyakargo/shared";
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
import { sendersApi } from "@/lib/api/senders";
import { useApiFormErrors } from "@/lib/useApiFormErrors";

interface SenderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful POST /senders — used by callers that need to
   *  auto-select the new sender (e.g. inline creation from the Receive form). */
  onCreated?: (sender: Sender) => void;
}

/** Reusable "new sender" dialog. Lives outside admin.senders.tsx so the
 *  Receive-lot flow can drop it in next to the sender Combobox. */
export function SenderFormDialog({ open, onOpenChange, onCreated }: SenderFormDialogProps) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const form = useForm<CreateSenderInput>({
    resolver: zodResolver(createSenderSchema),
    defaultValues: { fullName: "", phone: "", address: "", notes: "", isSelf: false },
  });
  const handleApiError = useApiFormErrors(form);

  // Clear stale form/error state every time the dialog re-opens so a previous
  // failed attempt doesn't pre-fill the inputs.
  useEffect(() => {
    if (open) {
      setServerError("");
      form.reset();
    }
  }, [open, form]);

  const create = useMutation({
    mutationFn: (data: CreateSenderInput) => sendersApi.create(data),
    onSuccess: (sender) => {
      qc.invalidateQueries({ queryKey: ["senders"] });
      onCreated?.(sender);
      onOpenChange(false);
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:btn_new_sender")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            create.mutate(d);
          })}
          className="space-y-3"
        >
          <FormError>{serverError}</FormError>
          <div className="space-y-1.5">
            <Label>{t("admin:col_name")}</Label>
            <Input {...form.register("fullName")} autoFocus autoComplete="name" />
            <FieldError>{form.formState.errors.fullName?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_phone")}</Label>
            <Input {...form.register("phone")} placeholder="+998..." autoComplete="tel" />
            <FieldError>{form.formState.errors.phone?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_address")}</Label>
            <Input {...form.register("address")} autoComplete="street-address" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_notes")}</Label>
            <Input {...form.register("notes")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("isSelf")} />
            {t("admin:isSelf_label")}
          </label>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
