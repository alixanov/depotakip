import { redirect } from "@tanstack/react-router";
import type { PermissionKey } from "@sadiyakargo/shared";
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

/**
 * Route-level guard for pages that require one or more permissions. AND-semantics.
 * Redirects to / when the user is signed in but lacks the permission, so
 * admin-only routes don't show a generic 404 to viewers.
 */
export function requirePermission(...required: PermissionKey[]) {
  return ({ location }: GuardCtx): void => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    for (const perm of required) {
      if (!user.role.permissions.includes(perm)) {
        throw redirect({ to: "/" });
      }
    }
  };
}

/** OR-semantics — at least one permission must be granted. */
export function requireAnyPermission(...required: PermissionKey[]) {
  return ({ location }: GuardCtx): void => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (!required.some((p) => user.role.permissions.includes(p))) {
      throw redirect({ to: "/" });
    }
  };
}
