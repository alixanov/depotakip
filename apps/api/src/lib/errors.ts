/**
 * Доменная ошибка с локализуемым кодом. Контракт:
 *
 * - `code` (machine-readable) — main signal: общий `BAD_REQUEST`/`NOT_FOUND`
 *   и т.п. для HTTP-семантики, ИЛИ доменный код вида `err:sender_not_found`
 *   который клиент переводит через `i18n.t(code, params)`. Доменный код
 *   побеждает.
 * - `params` (опц.) — интерполяция для перевода (`{{count}}`, `{{name}}`).
 * - `message` — human fallback (для логов + клиентов без перевода). Часто
 *   совпадает с code, потому что factories ниже подставляют code как
 *   default message, если не задан явно.
 * - `details` — дополнительный payload (zod issues, query context).
 *
 * Factories принимают первым аргументом либо человеческий текст (legacy,
 * фиксированный HTTP-code будет в `code`), либо `err:xxx` доменный код
 * (тогда `code = "err:xxx"`, message fallback'ом).
 */
export class AppError extends Error {
  status: number;
  code: string;
  params?: Record<string, unknown>;
  details?: unknown;

  constructor(opts: {
    message: string;
    status: number;
    code: string;
    params?: Record<string, unknown>;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.status = opts.status;
    this.code = opts.code;
    if (opts.params !== undefined) this.params = opts.params;
    if (opts.details !== undefined) this.details = opts.details;
  }
}

/** Доменный код всегда начинается с этого префикса. Используется на клиенте
 *  для switch'а между «переводить как ключ» и «показать как есть». */
const DOMAIN_PREFIX = "err:";

/** Извлекает code/message пары из (legacy|domain) первого аргумента. */
function pickCode(messageOrCode: string, fallbackCode: string): { code: string; message: string } {
  if (messageOrCode.startsWith(DOMAIN_PREFIX)) {
    return { code: messageOrCode, message: messageOrCode };
  }
  return { code: fallbackCode, message: messageOrCode };
}

export const badRequest = (
  messageOrCode: string,
  params?: Record<string, unknown>,
  details?: unknown
) => {
  const { code, message } = pickCode(messageOrCode, "BAD_REQUEST");
  return new AppError({ message, status: 400, code, params, details });
};

export const unauthorized = (messageOrCode = "Unauthorized", params?: Record<string, unknown>) => {
  const { code, message } = pickCode(messageOrCode, "UNAUTHORIZED");
  return new AppError({ message, status: 401, code, params });
};

export const forbidden = (messageOrCode = "Forbidden", params?: Record<string, unknown>) => {
  const { code, message } = pickCode(messageOrCode, "FORBIDDEN");
  return new AppError({ message, status: 403, code, params });
};

export const notFound = (messageOrCode = "Not found", params?: Record<string, unknown>) => {
  const { code, message } = pickCode(messageOrCode, "NOT_FOUND");
  return new AppError({ message, status: 404, code, params });
};

export const conflict = (messageOrCode: string, params?: Record<string, unknown>) => {
  const { code, message } = pickCode(messageOrCode, "CONFLICT");
  return new AppError({ message, status: 409, code, params });
};

export const validation = (messageOrCode: string, details?: unknown) => {
  const { code, message } = pickCode(messageOrCode, "VALIDATION");
  return new AppError({ message, status: 422, code, details });
};

export const tooManyRequests = (messageOrCode = "Too many requests") => {
  const { code, message } = pickCode(messageOrCode, "RATE_LIMITED");
  return new AppError({ message, status: 429, code });
};
