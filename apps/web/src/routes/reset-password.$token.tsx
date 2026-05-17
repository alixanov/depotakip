import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { passwordSchema } from "@sadiyakargo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormError } from "@/components/ui/form-error";
import { authApi } from "@/lib/api/auth";
import { useApiFormErrors } from "@/lib/useApiFormErrors";

const formSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Şifreler uyuşmuyor",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/reset-password/$token")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const handleApiError = useApiFormErrors(form);

  async function onSubmit(values: FormValues) {
    setError("");
    try {
      await authApi.resetPassword(token, values.password);
      navigate({ to: "/login" });
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth:resetTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormError>{error}</FormError>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth:newPassword")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <FieldError>{form.formState.errors.password?.message}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t("auth:newPasswordConfirm")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...form.register("confirm")}
              />
              <FieldError>{form.formState.errors.confirm?.message}</FieldError>
            </div>

            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              {t("auth:resetSubmit")}
            </Button>

            <div className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                {t("auth:backToLogin")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
