import type { CookieOptions } from "express";
import { env } from "../config/env.js";
import { parseDuration } from "./duration.js";

export const REFRESH_COOKIE = "sadiyakargo_refresh";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    // `lax` (was `strict`): prod web + api live on different `*.up.railway.app`
    // subdomains, which the browser treats as separate sites per the Public
    // Suffix List. Under `strict` the refresh cookie was never sent from
    // web→api → session dropped on every navigation. `lax` still blocks
    // CSRF for state-changing requests, and `originCheck` middleware is our
    // second CSRF layer for all mutating verbs.
    sameSite: "lax",
    path: `${env.API_PREFIX}/auth`,
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: parseDuration(env.JWT_REFRESH_TTL),
  };
}
