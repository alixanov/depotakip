import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "../../lib/cookies.js";
import * as service from "./auth.service.js";

function context(req: Request) {
  return {
    userAgent: req.get("user-agent") || "",
    ip: req.ip || req.socket.remoteAddress || "",
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const { accessToken, refreshToken, user } = await service.login(email, password, context(req));
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ user, accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const cookie = req.cookies?.[REFRESH_COOKIE];
  if (!cookie) throw unauthorized("Refresh cookie yok");
  const { accessToken, refreshToken, user } = await service.refresh(cookie, context(req));
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ user, accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const cookie = req.cookies?.[REFRESH_COOKIE];
  await service.logout(cookie);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.json({ ok: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw unauthorized();
  res.json({ user: await service.me(req.userId) });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await service.forgotPassword(email);
  res.json({ ok: true });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await service.resetPassword(token, password);
  res.json({ ok: true });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw unauthorized();
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  await service.changePassword(req.userId, currentPassword, newPassword);
  res.json({ ok: true });
});
