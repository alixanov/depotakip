import type {
  CreateSenderInput,
  PaginatedResponse,
  Sender,
  UpdateSenderInput,
} from "@sadiyakargo/shared";
import { request } from "./client";

export const sendersApi = {
  list: (params: { page?: number; limit?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<Sender>>(`/senders${suffix}`);
  },
  create: (input: CreateSenderInput) =>
    request<Sender>("/senders", { method: "POST", body: input }),
  update: (id: string, input: UpdateSenderInput) =>
    request<Sender>(`/senders/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/senders/${id}`, { method: "DELETE" }),
};
