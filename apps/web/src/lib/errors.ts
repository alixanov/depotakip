/**
 * Локализация серверных AppError через i18n.
 *
 * Контракт с backend (apps/api/src/lib/errors.ts):
 * - Доменные ошибки кидаются с `code = "err:xxx"` + опциональные `params`.
 * - Middleware пробрасывает {error, code, params} в response.
 * - На клиенте — `localizedMessage(err, t)` ищет `t(code, params)`. Если
 *   перевод найден — отдаёт его; иначе fallback на `err.message`
 *   (захардкоженный fallback с backend, обычно турецкий).
 *
 * Помимо ApiError поддерживает любой Error / неизвестный объект —
 * возвращает `t("error")` дженерик.
 */
import type { TFunction } from "i18next";
import { ApiError } from "@/lib/api/client";

const DOMAIN_PREFIX = "err:";

export function localizedMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.code?.startsWith(DOMAIN_PREFIX)) {
      const translated = t(err.code, err.params as Record<string, unknown> | undefined);
      // i18next возвращает ключ как fallback при отсутствии перевода —
      // не показываем сырой `err:xxx` в UI, лучше дефолтный message.
      if (translated && translated !== err.code) return translated;
    }
    return err.message || t("error");
  }
  if (err instanceof Error) return err.message || t("error");
  return t("error");
}
