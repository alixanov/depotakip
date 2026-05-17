import type {
  Carrier,
  CreateCarrierInput,
  PaginatedResponse,
  UpdateCarrierInput,
} from "@depotakip/shared";
import { request } from "./client";

export const carriersApi = {
  list: (params: { page?: number; limit?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<Carrier>>(`/carriers${suffix}`);
  },
  create: (input: CreateCarrierInput) =>
    request<Carrier>("/carriers", { method: "POST", body: input }),
  update: (id: string, input: UpdateCarrierInput) =>
    request<Carrier>(`/carriers/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/carriers/${id}`, { method: "DELETE" }),
};
