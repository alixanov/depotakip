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

// Guards against (a) cyclic graphs (Mongoose subdocs carry $__parent → owner
// → subdoc) and (b) accidental traversal into framework internals. Anything
// past the cap or already-seen is collapsed to `null` rather than thrown so
// audit logging never breaks a real request.
const SANITIZE_MAX_DEPTH = 12;

function sanitize<T>(value: T): T {
  return sanitizeInner(value, 0, new WeakSet()) as T;
}

function sanitizeInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > SANITIZE_MAX_DEPTH) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeInner(v, depth + 1, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return null;
    seen.add(value);
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Skip Mongoose-internal keys ($__, $__parent, $__schemaType, $op, …
      // and _doc) so we never recurse into the prototype/parent chain in the
      // first place. WeakSet below is a backstop for anything that slips
      // through (e.g. third-party objects with their own cycles).
      if (k.startsWith("$") || k === "_doc") continue;
      if (k === "passwordHash" || k === "password" || k === "tempPassword") continue;
      if (k === "phone" || k === "telefon") {
        out[k] = typeof v === "string" ? v.replace(/(\+?\d{2})\d+(\d{4})/, "$1***$2") : v;
        continue;
      }
      out[k] = sanitizeInner(v, depth + 1, seen);
    }
    return out;
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
