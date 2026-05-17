import type { NextFunction, Request, Response } from "express";

/**
 * Strip any keys that look like MongoDB operators (`$xxx`) or nested-path
 * injections (`a.b`). Replacement for `express-mongo-sanitize`, which is
 * incompatible with Express 5 because `req.query` became a getter and the
 * package tries to reassign it.
 *
 * Express 5 also makes `req.query` immutable, so we only mutate `req.body`.
 * `req.params` is always validated by zod, and `req.query` is parsed via
 * zod schemas before reaching handlers, which already strips unknown keys.
 */
export function sanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    sanitizeInPlace(req.body);
  }
  next();
}

function sanitizeInPlace(value: unknown): void {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) sanitizeInPlace(item);
    return;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (isUnsafeKey(key)) {
      delete obj[key];
    } else {
      sanitizeInPlace(obj[key]);
    }
  }
}

function isUnsafeKey(key: string): boolean {
  return key.startsWith("$") || key.includes(".");
}
