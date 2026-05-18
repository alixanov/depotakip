import type { NextFunction, Request, Response } from "express";
import { unauthorized, forbidden } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    orgId?: string;
    roleId?: string;
    /** Permission keys granted by the user's current role (snapshot from JWT). */
    userPermissions?: string[];
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    next(unauthorized("Token gerekli"));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.orgId = payload.orgId;
    req.roleId = payload.roleId;
    req.userPermissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    next();
  } catch {
    next(unauthorized("Geçersiz veya süresi dolmuş token"));
  }
}

/**
 * AND-semantics: every key must be present in the user's permission set.
 * For OR use `requireAnyPermission`. Always pair with `requireAuth` upstream.
 */
export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const perms = req.userPermissions;
    if (!perms) {
      next(unauthorized());
      return;
    }
    for (const key of required) {
      if (!perms.includes(key)) {
        next(forbidden(`Yetkisiz işlem (gerekli: ${key})`));
        return;
      }
    }
    next();
  };
}

export function requireAnyPermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const perms = req.userPermissions;
    if (!perms) {
      next(unauthorized());
      return;
    }
    if (!required.some((k) => perms.includes(k))) {
      next(forbidden(`Yetkisiz işlem (gerekli: ${required.join(" | ")})`));
      return;
    }
    next();
  };
}
