import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth";

/**
 * Centralised logout: revoke refresh token on the server, clear the auth
 * store, and redirect to /login. Survives API failure (local clear is what
 * matters for UX). Used by the header UserMenu, the mobile drawer, and the
 * profile page so the action is consistent everywhere.
 */
export function useLogout(): () => Promise<void> {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  return useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — even if the server call fails, we still want a local clear
    }
    clear();
    navigate({ to: "/login" });
  }, [clear, navigate]);
}
