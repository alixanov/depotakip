import type { Category, CreateCategoryInput, UpdateCategoryInput } from "@sadiyakargo/shared";
import { request } from "./client";

export const categoriesApi = {
  list: (params: { active?: boolean } = {}) => {
    const qs = params.active ? "?active=true" : "";
    return request<Category[]>(`/categories${qs}`);
  },
  create: (input: CreateCategoryInput) =>
    request<Category>("/categories", { method: "POST", body: input }),
  update: (id: string, input: UpdateCategoryInput) =>
    request<Category>(`/categories/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/categories/${id}`, { method: "DELETE" }),
};
