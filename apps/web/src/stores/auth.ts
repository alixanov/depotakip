import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PermissionKey, User } from "@sadiyakargo/shared";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null }),
    }),
    {
      name: "sadiyakargo-auth",
      // Don't persist accessToken — keep it in memory only. Refresh cookie
      // brings the user back in via /auth/refresh after a hard reload.
      partialize: (s) => ({ user: s.user }),
    }
  )
);

/**
 * Hook-friendly permission check. Returns false until the user logs in.
 * For components that already pulled `user` from the store, the standalone
 * `userCan(user, perm)` helper avoids an extra subscription. Typed against
 * `PermissionKey` so a typo like "lots:wrtie" fails at compile time.
 *
 * NOTE: this reads from a Zustand-persisted snapshot. Permissions can drift
 * up to the access-token TTL (15 min) after admin changes; the backend
 * `requirePermission` middleware is the real security boundary.
 */
export function useCan(perm: PermissionKey): boolean {
  return useAuthStore((s) => !!s.user?.role.permissions.includes(perm));
}

export function useCanAny(...perms: PermissionKey[]): boolean {
  return useAuthStore((s) => {
    const granted = s.user?.role.permissions ?? [];
    return perms.some((p) => granted.includes(p));
  });
}

export function userCan(user: User | null | undefined, perm: PermissionKey): boolean {
  return !!user?.role.permissions.includes(perm);
}
