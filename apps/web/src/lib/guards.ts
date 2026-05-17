import { redirect } from "@tanstack/react-router";
import type { Role } from "@sadiyakargo/shared";
import { useAuthStore } from "@/stores/auth";

interface GuardCtx {
  location: { href: string };
}

/** TanStack Router `beforeLoad` guard: redirect to /login if not authenticated. */
export function requireAuth({ location }: GuardCtx): void {
  const { user, accessToken } = useAuthStore.getState();
  if (!user && !accessToken) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
}

/** Variant of `requireAuth` that also enforces a role allow-list. */
export function requireRole(...roles: Role[]) {
  return ({ location }: GuardCtx): void => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (!roles.includes(user.role)) {
      throw redirect({ to: "/" });
    }
  };
}
