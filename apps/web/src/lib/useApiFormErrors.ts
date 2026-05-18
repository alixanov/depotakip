import { useTranslation } from "react-i18next";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/lib/api/client";
import { localizedMessage } from "@/lib/errors";
import { translateValidationKey } from "@/lib/zod-i18n";

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
      // Backend bubbles zod-сообщения "as-is" в fields/details. Если это
      // наш ключ "validation:xxx" — переводим перед setError, иначе RHF
      // прокинет raw ключ в UI.
      form.setError(
        name as Path<T>,
        { type: "server", message: translateValidationKey(fields[name]) },
        i === 0 ? { shouldFocus: true } : undefined
      );
    });

    // Если хотя бы одну ошибку удалось привязать к полю формы —
    // оставляем top-level banner пустым (FieldError под нужным
    // <Input/> уже достаточен; иначе одно и то же сообщение
    // дублируется и в banner'е, и под полем). Если ни одна не
    // замапилась (пустой fields, общая 500/network, mongoose path
    // не совпал с формой) — показываем общий message, чтобы
    // пользователь видел хоть какой-то сигнал.
    return names.length > 0 ? "" : localizedMessage(err, t);
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
