import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@depotakip/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormError } from "@/components/ui/form-error";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { authApi } from "@/lib/api/auth";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireAuth } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  const handleApiError = useApiFormErrors(form);

  async function onSubmit(values: ChangePasswordInput) {
    setServerError("");
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      form.reset();
      toast.success(t("auth:changeSuccess"));
    } catch (err) {
      setServerError(handleApiError(err));
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile:info_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label={t("profile:info_name")}>{user.fullName}</Field>
            <Field label={t("profile:info_email")}>{user.email}</Field>
            <Field label={t("profile:info_phone")}>{user.phone || "—"}</Field>
            <Field label={t("profile:info_role")}>{user.role}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile:password_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormError>{serverError}</FormError>

            <div className="space-y-1.5">
              <Label htmlFor="current">{t("auth:currentPassword")}</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                {...form.register("currentPassword")}
              />
              <FieldError>{form.formState.errors.currentPassword?.message}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new">{t("auth:newPassword")}</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                {...form.register("newPassword")}
              />
              <FieldError>{form.formState.errors.newPassword?.message}</FieldError>
            </div>

            <Button type="submit" loading={form.formState.isSubmitting}>
              {t("auth:changeSubmit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}
