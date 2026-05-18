import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { forbidden } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_ORIGINS = env.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** CSRF defence layer 2 (layer 1 is SameSite=Lax on the refresh cookie —
 *  Strict was rejected because prod web + api live on different Railway
 *  subdomains, see cookies.ts for the full rationale).
 *  For unsafe methods, require Origin/Referer to match the allow-list. */
export function originCheck(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (env.NODE_ENV === "test") return next();

  const header = req.get("origin") || req.get("referer");
  if (!header) return next(forbidden("Origin header required"));

  let originUrl: URL;
  try {
    originUrl = new URL(header);
  } catch {
    return next(forbidden("Malformed Origin"));
  }

  const allowed = ALLOWED_ORIGINS.some((allow) => {
    try {
      return new URL(allow).origin === originUrl.origin;
    } catch {
      return false;
    }
  });

  if (!allowed) return next(forbidden("Origin not allowed"));
  next();
}
