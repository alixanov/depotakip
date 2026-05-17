import type { PaginatedResponse } from "@sadiyakargo/shared";
import { request } from "./client";

export interface AuditEntry {
  id: string;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  action: "create" | "update" | "delete" | "login" | "logout" | "export" | "status_change";
  entityType: string;
  entityId: string | null;
  diff: { before?: unknown; after?: unknown } | null;
  ip: string;
  userAgent: string;
  at: string;
}

export const auditApi = {
  list: (
    params: {
      page?: number;
      limit?: number;
      entityType?: string;
      action?: string;
      userId?: string;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<AuditEntry>>(`/audit-log${suffix}`);
  },
};
