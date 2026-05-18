import type {
  CreatePermissionInput,
  CreateRoleInput,
  Permission,
  Role,
  UpdatePermissionInput,
  UpdateRoleInput,
} from "@sadiyakargo/shared";
import { request } from "./client";

export const permissionsApi = {
  list: () => request<Permission[]>("/permissions"),
  create: (input: CreatePermissionInput) =>
    request<Permission>("/permissions", { method: "POST", body: input }),
  update: (id: string, input: UpdatePermissionInput) =>
    request<Permission>(`/permissions/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/permissions/${id}`, { method: "DELETE" }),
};

export const rolesApi = {
  list: () => request<Role[]>("/roles"),
  get: (id: string) => request<Role>(`/roles/${id}`),
  create: (input: CreateRoleInput) => request<Role>("/roles", { method: "POST", body: input }),
  update: (id: string, input: UpdateRoleInput) =>
    request<Role>(`/roles/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/roles/${id}`, { method: "DELETE" }),
};
