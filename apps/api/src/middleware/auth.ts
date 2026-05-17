import type { NextFunction, Request, Response } from "express";
import type { Role } from "@sadiyakargo/shared";
import { unauthorized, forbidden } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    userRole?: Role;
    orgId?: string;
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
    req.userRole = payload.role as Role;
    req.orgId = payload.orgId;
    next();
  } catch {
    next(unauthorized("Geçersiz veya süresi dolmuş token"));
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      next(unauthorized());
      return;
    }
    if (!allowed.includes(req.userRole)) {
      next(forbidden("Yetkisiz işlem"));
      return;
    }
    next();
  };
}
