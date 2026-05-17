import type {
  CreateTemplateInput,
  NotificationTemplateKey,
  PaginatedResponse,
  UpdateTemplateInput,
} from "@depotakip/shared";
import { request } from "./client";

export interface TemplateRow {
  id: string;
  key: NotificationTemplateKey;
  channel: "sms" | "telegram";
  language: "tr" | "ru" | "uz";
  body: string;
  active: boolean;
}

export interface LogRow {
  id: string;
  channel: "sms" | "telegram";
  recipientType: "sender" | "carrier" | "recipient";
  templateKey: NotificationTemplateKey;
  renderedText: string;
  status: "queued" | "sent" | "failed";
  attempts: number;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export const notificationsApi = {
  templates: {
    list: () => request<TemplateRow[]>("/notifications/templates"),
    create: (input: CreateTemplateInput) =>
      request<TemplateRow>("/notifications/templates", { method: "POST", body: input }),
    update: (id: string, input: UpdateTemplateInput) =>
      request<TemplateRow>(`/notifications/templates/${id}`, {
        method: "PATCH",
        body: input,
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/notifications/templates/${id}`, { method: "DELETE" }),
  },
  logs: (params: { page?: number; status?: "queued" | "sent" | "failed" } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<LogRow>>(`/notifications/logs${suffix}`);
  },
};
