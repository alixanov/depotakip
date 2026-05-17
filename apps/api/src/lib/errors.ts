export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 500, code = "INTERNAL", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(message, 400, "BAD_REQUEST", details);

export const unauthorized = (message = "Unauthorized") =>
  new AppError(message, 401, "UNAUTHORIZED");

export const forbidden = (message = "Forbidden") => new AppError(message, 403, "FORBIDDEN");

export const notFound = (message = "Not found") => new AppError(message, 404, "NOT_FOUND");

export const conflict = (message: string) => new AppError(message, 409, "CONFLICT");

export const validation = (message: string, details?: unknown) =>
  new AppError(message, 422, "VALIDATION", details);

export const tooManyRequests = (message = "Too many requests") =>
  new AppError(message, 429, "RATE_LIMITED");
