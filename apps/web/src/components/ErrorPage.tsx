import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorPageProps {
  error: unknown;
  reset?: () => void;
}

/**
 * Default error boundary for TanStack Router routes. Shows a friendly
 * message instead of a blank white screen on render failures.
 */
export function ErrorPage({ error, reset }: ErrorPageProps) {
  const { t } = useTranslation();
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : t("error");

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="mt-2">{t("errorBoundary:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t("errorBoundary:description")}</p>
          <pre className="rounded-md bg-muted p-3 text-left text-xs text-muted-foreground overflow-auto max-h-40">
            {message}
          </pre>
          <div className="flex justify-center gap-2">
            {reset && (
              <Button onClick={reset} variant="outline">
                <RotateCcw className="mr-1 h-4 w-4" />
                {t("errorBoundary:retry")}
              </Button>
            )}
            <Link to="/">
              <Button>{t("errorBoundary:home")}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
