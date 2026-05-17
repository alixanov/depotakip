import { useTranslation } from "react-i18next";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/lib/api/client";

/**
 * Bridges server validation into react-hook-form. Returns a callback that:
 *  1. extracts per-field errors from `ApiError` (both `.fields` map and the
 *     legacy `.details: [{path, message}]` array from zod), then
 *  2. attaches each one to its matching form field via `setError(name)` with
 *     `shouldFocus: true` on the first field, so the user lands on it,
 *  3. returns a string for the top-level `FormError` banner — empty when
 *     every error mapped to a field, the raw API message otherwise, and the
 *     i18n fallback for non-ApiError failures.
 */
export function useApiFormErrors<T extends FieldValues>(form: UseFormReturn<T>) {
  const { t } = useTranslation();

  return (err: unknown): string => {
    if (!(err instanceof ApiError)) return t("error");

    const fields = extractFields(err);
    const names = Object.keys(fields);

    names.forEach((name, i) => {
      form.setError(
        name as Path<T>,
        { type: "server", message: fields[name] },
        i === 0 ? { shouldFocus: true } : undefined
      );
    });

    // If every error was mapped to a field, suppress the top banner —
    // the fields themselves carry the message. Otherwise surface ApiError.message.
    return names.length > 0 ? "" : err.message;
  };
}

function extractFields(err: ApiError): Record<string, string> {
  if (err.fields && Object.keys(err.fields).length > 0) return err.fields;

  if (Array.isArray(err.details)) {
    const out: Record<string, string> = {};
    for (const d of err.details) {
      if (
        d &&
        typeof d === "object" &&
        "path" in d &&
        "message" in d &&
        typeof (d as { path: unknown }).path === "string" &&
        typeof (d as { message: unknown }).message === "string"
      ) {
        const path = (d as { path: string }).path;
        const message = (d as { message: string }).message;
        if (path) out[path] = message;
      }
    }
    return out;
  }
  return {};
}
