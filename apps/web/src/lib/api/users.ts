import type {
  CreateUserInput,
  PaginatedResponse,
  UpdateUserInput,
  User,
} from "@sadiyakargo/shared";
import { request } from "./client";

export interface CreateUserResponse {
  user: User;
  tempPassword: string;
}

export const usersApi = {
  list: (params: { page?: number; limit?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<User>>(`/users${suffix}`);
  },

  get: (id: string) => request<User>(`/users/${id}`),

  create: (input: CreateUserInput) =>
    request<CreateUserResponse>("/users", { method: "POST", body: input }),

  update: (id: string, input: UpdateUserInput) =>
    request<User>(`/users/${id}`, { method: "PATCH", body: input }),

  remove: (id: string) => request<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
};
