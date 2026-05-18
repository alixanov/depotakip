import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { sendersApi } from "@/lib/api/senders";
import { useApiFormErrors } from "@/lib/useApiFormErrors";

interface SenderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided — edit mode (PATCH /senders/:id); when undefined — create mode. */
  sender?: Sender;
  /** Fires after a successful create or update. Receives the saved sender so
   *  callers can auto-select it (e.g. inline creation from the Receive form). */
  onSaved?: (sender: Sender) => void;
}

const EMPTY: CreateSenderInput = {
  fullName: "",
  phone: "",
  address: "",
  notes: "",
  isSelf: false,
  telegramChatId: null,
  telegramUsername: null,
};

/** Reusable sender dialog supporting both create and edit. Lives outside
 *  admin.senders.tsx so the Receive-lot flow can drop it in next to the
 *  sender Combobox (always in create mode there). */
export function SenderFormDialog({ open, onOpenChange, sender, onSaved }: SenderFormDialogProps) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const isEdit = !!sender;
  const form = useForm<CreateSenderInput>({
    resolver: zodResolver(createSenderSchema),
    defaultValues: EMPTY,
  });
  const handleApiError = useApiFormErrors(form);

  // Reset on every open so the previous attempt (or previously-edited row)
  // doesn't bleed into the next session.
  useEffect(() => {
    if (!open) return;
    setServerError("");
    form.reset(
      sender
        ? {
            fullName: sender.fullName,
            phone: sender.phone,
            address: sender.address ?? "",
            notes: sender.notes ?? "",
            isSelf: sender.isSelf,
            telegramChatId: sender.telegramChatId,
            telegramUsername: sender.telegramUsername,
          }
        : EMPTY
    );
  }, [open, sender, form]);

  const onSuccess = (saved: Sender) => {
    qc.invalidateQueries({ queryKey: ["senders"] });
    onSaved?.(saved);
    onOpenChange(false);
  };
  const onError = (err: unknown) => setServerError(handleApiError(err));

  const create = useMutation({
    mutationFn: (data: CreateSenderInput) => sendersApi.create(data),
    onSuccess,
    onError,
  });
  const update = useMutation({
    mutationFn: (data: CreateSenderInput) => sendersApi.update(sender!.id, data),
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
              ? t("admin:btn_edit_sender", { name: sender!.fullName })
              : t("admin:btn_new_sender")}
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
          <div className="space-y-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox {...form.register("isSelf")} />
              {t("admin:isSelf_label")}
            </label>
            {isEdit && (
              <p className="text-xs text-muted-foreground">{t("admin:isSelf_change_hint")}</p>
            )}
          </div>
          <Button type="submit" className="w-full" loading={mutation.isPending}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
