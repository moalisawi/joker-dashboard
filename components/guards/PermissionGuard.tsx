"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { hasPermission, hasAnyPermission } from "@/lib/permissionGuards";
import type { PermKey } from "@/constants/permissions";
import type { Role } from "@/types";

interface PermissionGuardProps {
  /** Single required permission */
  permission?: PermKey;
  /** OR logic — at least one must pass */
  anyOf?: PermKey[];
  /** Minimum role required (owner > admin > employee) */
  role?: Role;
  /** Where to redirect on failure. Defaults to "/" */
  redirectTo?: string;
  children: React.ReactNode;
}

const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, employee: 1 };

/**
 * Route-level guard. Redirects to `redirectTo` when the authenticated user
 * does not satisfy the permission/role requirements.
 *
 * Use this at the top of page components that require a hard access boundary.
 * For soft show/hide within a page use `RequirePermission` instead.
 */
export default function PermissionGuard({
  permission,
  anyOf,
  role,
  redirectTo = "/",
  children,
}: PermissionGuardProps) {
  const router  = useRouter();
  const user    = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading || !user) return;

    let allowed = true;

    if (role && ROLE_RANK[user.role] < ROLE_RANK[role]) allowed = false;
    if (permission && !hasPermission(user, permission))  allowed = false;
    if (anyOf && !hasAnyPermission(user, anyOf))         allowed = false;

    if (!allowed) router.replace(redirectTo);
  }, [user, loading, role, permission, anyOf, redirectTo, router]);

  // While auth is loading, render nothing to avoid flash
  if (loading || !user) return null;

  let allowed = true;
  if (role && ROLE_RANK[user.role] < ROLE_RANK[role]) allowed = false;
  if (permission && !hasPermission(user, permission))  allowed = false;
  if (anyOf && !hasAnyPermission(user, anyOf))         allowed = false;

  if (!allowed) return null;
  return <>{children}</>;
}
