/**
 * Глобальный zod error map → i18next.
 *
 * Покрывает два случая:
 * 1) Дефолтные сообщения zod типа `"Expected number, received nan"` —
 *    мапятся в `validation:*` ключи по `issue.code` (+ дополнительные
 *    discriminator'ы вроде `received`/`validation`/`type`).
 * 2) Кастомные сообщения, заданные в shared/local zod-схемах как ключи
 *    вида `"validation:xxx"` — просто `i18n.t(message)`. Это удобно, когда
 *    хочется не лезть в errorMap и описать ошибку прямо в `.refine(...)`
 *    или `z.string().email("validation:invalid_email")`.
 *
 * Срабатывает и при clientside-валидации через zodResolver, и при показе
 * server-side ошибок (см. useApiFormErrors → backend пробрасывает наши
 * ключи в `error.fields[X]` / `error.details[i].message`).
 *
 * Импортируется один раз из main.tsx — `setErrorMap` глобальный.
 */
import { z } from "zod";
import i18n from "./i18n";

const KEY_PREFIX = "validation:";

/** Map по issue.code → ключ + опциональные интерполяции. */
function defaultIssueKey(issue: z.ZodIssueOptionalMessage): {
  key: string;
  vars?: Record<string, unknown>;
} | null {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type: {
      // Самый частый случай в bug-репорте: `qtyIn` пустой → coerce.number()
      // → NaN → received="nan" → "Expected number, received nan".
      if (issue.received === "nan") return { key: "validation:expected_number" };
      if (issue.received === "undefined" || issue.received === "null") {
        return { key: "validation:required" };
      }
      return {
        key: "validation:invalid_type",
        vars: { expected: issue.expected, received: issue.received },
      };
    }
    case z.ZodIssueCode.invalid_string: {
      if (issue.validation === "email") return { key: "validation:invalid_email" };
      if (issue.validation === "url") return { key: "validation:invalid_url" };
      if (issue.validation === "uuid") return { key: "validation:invalid_uuid" };
      if (issue.validation === "regex") return { key: "validation:invalid_format" };
      if (issue.validation === "datetime") return { key: "validation:invalid_datetime" };
      if (issue.validation === "date") return { key: "validation:invalid_date" };
      return { key: "validation:invalid_format" };
    }
    case z.ZodIssueCode.too_small: {
      if (issue.type === "string") {
        if (issue.minimum === 1) return { key: "validation:string_required" };
        return { key: "validation:string_min", vars: { min: issue.minimum } };
      }
      if (issue.type === "number") {
        return { key: "validation:number_min", vars: { min: issue.minimum } };
      }
      if (issue.type === "array") {
        return { key: "validation:array_min", vars: { min: issue.minimum } };
      }
      return null;
    }
    case z.ZodIssueCode.too_big: {
      if (issue.type === "string") {
        return { key: "validation:string_max", vars: { max: issue.maximum } };
      }
      if (issue.type === "number") {
        return { key: "validation:number_max", vars: { max: issue.maximum } };
      }
      if (issue.type === "array") {
        return { key: "validation:array_max", vars: { max: issue.maximum } };
      }
      return null;
    }
    case z.ZodIssueCode.invalid_enum_value:
      return { key: "validation:invalid_option" };
    case z.ZodIssueCode.unrecognized_keys:
      return { key: "validation:unrecognized_keys" };
    case z.ZodIssueCode.invalid_arguments:
    case z.ZodIssueCode.invalid_return_type:
      return { key: "validation:invalid_value" };
    case z.ZodIssueCode.custom:
      // Custom-refine без сообщения попадает сюда. Если в .refine() задано
      // имя ошибки, оно уже в issue.message (обрабатывается выше до switch).
      return { key: "validation:invalid_value" };
    default:
      return null;
  }
}

const errorMap: z.ZodErrorMap = (issue, ctx) => {
  // (1) Если в issue.message уже передан наш ключ — переводим напрямую.
  if (typeof issue.message === "string" && issue.message.startsWith(KEY_PREFIX)) {
    return { message: i18n.t(issue.message) };
  }

  // (2) Дефолтный mapping по issue.code.
  const mapped = defaultIssueKey(issue);
  if (mapped) {
    const translated = i18n.t(mapped.key, mapped.vars);
    // Если перевода нет, i18next вернёт сам ключ — лучше fallback к zod-дефолту.
    if (translated && translated !== mapped.key) {
      return { message: translated };
    }
  }
  return { message: ctx.defaultError };
};

/** Вызывается один раз из main.tsx. Идемпотентно. */
export function installZodI18n(): void {
  z.setErrorMap(errorMap);
}

/** Хелпер для UI — переводит строку, если она — наш ключ. Иначе возвращает
 *  как есть. Используется в useApiFormErrors для серверных ошибок. */
export function translateValidationKey(message: string): string {
  if (message.startsWith(KEY_PREFIX)) return i18n.t(message);
  return message;
}
