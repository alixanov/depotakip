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
