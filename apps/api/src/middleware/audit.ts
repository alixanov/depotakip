import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { AuditLog, type AuditAction } from "../modules/audit/audit.model.js";
import { logger } from "../lib/logger.js";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function actionFromMethod(method: string, url: string): AuditAction {
  if (method === "DELETE") return "delete";
  if (method === "POST" && /\/login$/.test(url)) return "login";
  if (method === "POST" && /\/logout$/.test(url)) return "logout";
  if (method === "PATCH" && /\/status$/.test(url)) return "status_change";
  if (method === "POST") return "create";
  return "update";
}

function entityTypeFromUrl(url: string): { type: string; id: string | null } {
  const m = /\/api\/v\d+\/([\w-]+)(?:\/([0-9a-fA-F]{24}))?/.exec(url);
  if (!m) return { type: "unknown", id: null };
  return { type: m[1], id: m[2] || null };
}

function sanitize<T>(value: T): T {
  if (typeof value === "string") return value as T;
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "passwordHash" || k === "password" || k === "tempPassword") continue;
      if (k === "phone" || k === "telefon") {
        out[k] = typeof v === "string" ? v.replace(/(\+?\d{2})\d+(\d{4})/, "$1***$2") : v;
        continue;
      }
      out[k] = sanitize(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Global audit middleware: persists a row for every successful mutating
 * request. Patches res.json so it stays a no-op on non-2xx responses.
 */
export function audit(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) return next();

  const originalJson = res.json.bind(res);
  res.json = function patched(body: unknown): Response {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const { type, id } = entityTypeFromUrl(req.originalUrl);
      const action = actionFromMethod(req.method, req.originalUrl);
      const entityId =
        id ||
        (body && typeof body === "object" && "id" in body
          ? String((body as { id?: unknown }).id || "")
          : null);

      AuditLog.create({
        orgId: req.orgId
          ? new Types.ObjectId(req.orgId)
          : new Types.ObjectId("000000000000000000000001"),
        userId: req.userId ? new Types.ObjectId(req.userId) : null,
        action,
        entityType: type,
        entityId: entityId || null,
        diff: { after: sanitize(body) },
        ip: req.ip || "",
        userAgent: req.get("user-agent") || "",
        at: new Date(),
      }).catch((err: unknown) => {
        logger.error({ err }, "audit_write_failed");
      });
    }
    return originalJson(body);
  };
  next();
}
