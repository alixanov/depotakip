import type { User } from "@depotakip/shared";
import { request } from "./client";

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),

  refresh: () => request<AuthResponse>("/auth/refresh", { method: "POST", auth: false }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST", auth: false }),

  me: () => request<{ user: User }>("/auth/me"),

  forgotPassword: (email: string) =>
    request<{ ok: true }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: true }>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
      auth: false,
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),
};
