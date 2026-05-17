import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { loginSchema, type LoginInput } from "@depotakip/shared";
import { ArrowRight, Boxes, ShieldCheck, Truck } from "lucide-react";
import { z } from "zod";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/form-error";
import { LanguageSwitcher, ThemeToggle } from "@/components/HeaderControls";
import { authApi } from "@/lib/api/auth";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { useAuthStore } from "@/stores/auth";

const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search) => searchSchema.parse(search),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string>("");
  const { t } = useTranslation();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const handleApiError = useApiFormErrors(form);

  async function onSubmit(values: LoginInput) {
    setServerError("");
    try {
      const result = await authApi.login(values.email, values.password);
      setSession(result.user, result.accessToken);
      navigate({ to: redirect || "/" });
    } catch (err) {
      setServerError(handleApiError(err));
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* — Left: brand panel (collapsed on mobile) — */}
      <aside
        className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ background: "var(--brand-gradient)" }}
      >
        {/* Decorative ambient glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 400px at 20% 20%, rgba(255,255,255,0.15), transparent 60%), radial-gradient(500px 300px at 80% 80%, rgba(255,255,255,0.08), transparent 60%)",
          }}
        />
        {/* Soft noise texture for premium feel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.5'/></svg>\")",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <BrandMark size={44} className="rounded-2xl shadow-lg ring-1 ring-white/10" />
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-lg font-extrabold tracking-tight text-white">Sadiya</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">
              Kargo
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              {t("appName")}
            </p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">{t("appSubtitle")}</h2>
            <p className="text-base leading-relaxed text-white/80">{t("auth:heroTagline")}</p>
          </div>

          {/* Process flow visualization: Depo → Yolda → Teslim */}
          <ol className="space-y-3">
            <FlowStep
              icon={<Boxes className="h-4 w-4" />}
              title={t("nav:warehouse")}
              caption={t("auth:flowStep1")}
            />
            <FlowStep
              icon={<Truck className="h-4 w-4" />}
              title={t("nav:ship")}
              caption={t("auth:flowStep2")}
            />
            <FlowStep
              icon={<ShieldCheck className="h-4 w-4" />}
              title={t("status:teslim")}
              caption={t("auth:flowStep3")}
              last
            />
          </ol>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-white/60">
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>
            © {new Date().getFullYear()} Sadiya Kargo · {t("appSubtitle")}
          </span>
        </div>
      </aside>

      {/* — Right: form — */}
      <main className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-end gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm space-y-7">
            {/* Mobile brand mark */}
            <div className="flex items-center gap-3 lg:hidden">
              <BrandMark size={40} className="rounded-xl shadow-brand-glow" />
              <BrandWordmark className="text-lg" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{t("auth:welcomeBack")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth:subtitle")}</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormError>{serverError}</FormError>

              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth:email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...form.register("email")}
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth:password")}</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("auth:forgot")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                <FieldError>{form.formState.errors.password?.message}</FieldError>
              </div>

              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full"
                loading={form.formState.isSubmitting}
              >
                {t("auth:submit")}
                {!form.formState.isSubmitting && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">{t("auth:secureNote")}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function FlowStep({
  icon,
  title,
  caption,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/20 backdrop-blur">
          {icon}
        </span>
        {!last && <span className="my-1 h-8 w-px bg-white/20" />}
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-white/70">{caption}</p>
      </div>
    </li>
  );
}
