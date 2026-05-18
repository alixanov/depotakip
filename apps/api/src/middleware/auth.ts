import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "@sadiyakargo/shared";
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
    next(unauthorized("err:token_required"));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.orgId = payload.orgId;
    req.roleId = payload.roleId;
    // Defensive filter: if a future bug ever signs a JWT with non-string
    // permission entries, `requirePermission` would silently 403 everyone
    // forever. Drop anything we can't compare against.
    req.userPermissions = Array.isArray(payload.permissions)
      ? payload.permissions.filter((p): p is string => typeof p === "string")
      : [];
    next();
  } catch {
    next(unauthorized("err:token_invalid"));
  }
}

/**
 * AND-semantics: every key must be present in the user's permission set.
 * For OR use `requireAnyPermission`. Always pair with `requireAuth` upstream.
 */
export function requirePermission(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const perms = req.userPermissions;
    if (!perms) {
      next(unauthorized());
      return;
    }
    for (const key of required) {
      if (!perms.includes(key)) {
        next(forbidden("err:permission_required", { key }));
        return;
      }
    }
    next();
  };
}

export function requireAnyPermission(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const perms = req.userPermissions;
    if (!perms) {
      next(unauthorized());
      return;
    }
    if (!required.some((k) => perms.includes(k))) {
      next(forbidden("err:permission_required_any", { keys: required.join(" | ") }));
      return;
    }
    next();
  };
}
