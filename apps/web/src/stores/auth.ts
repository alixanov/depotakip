import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@sadiyakargo/shared";

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
 * `userCan(user, perm)` helper avoids an extra subscription.
 */
export function useCan(perm: string): boolean {
  return useAuthStore((s) => !!s.user?.role.permissions.includes(perm));
}

export function useCanAny(...perms: string[]): boolean {
  return useAuthStore((s) => {
    const granted = s.user?.role.permissions ?? [];
    return perms.some((p) => granted.includes(p));
  });
}

export function userCan(user: User | null | undefined, perm: string): boolean {
  return !!user?.role.permissions.includes(perm);
}
