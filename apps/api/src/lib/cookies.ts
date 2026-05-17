import type { CookieOptions } from "express";
import { env } from "../config/env.js";
import { parseDuration } from "./duration.js";

export const REFRESH_COOKIE = "sadiyakargo_refresh";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    sameSite: "strict",
    path: `${env.API_PREFIX}/auth`,
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: parseDuration(env.JWT_REFRESH_TTL),
  };
}
