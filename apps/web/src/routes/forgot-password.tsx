import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@sadiyakargo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormError } from "@/components/ui/form-error";
import { authApi } from "@/lib/api/auth";
import { useApiFormErrors } from "@/lib/useApiFormErrors";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const handleApiError = useApiFormErrors(form);

  async function onSubmit(values: ForgotPasswordInput) {
    setError("");
    try {
      await authApi.forgotPassword(values.email);
      setSubmitted(true);
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth:forgotTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("auth:forgotSubtitle")}</p>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t("auth:forgotSent")}
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  {t("auth:backToLogin")}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormError>{error}</FormError>

              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth:email")}</Label>
                <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </div>

              <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
                {t("auth:forgotSubmit")}
              </Button>

              <div className="text-center text-sm">
                <Link to="/login" className="text-primary hover:underline">
                  {t("auth:backToLogin")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
