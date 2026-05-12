"use client";

import { useAuthStore } from "@/store/authStore";
import { hasPermission, hasAnyPermission } from "@/lib/permissionGuards";
import type { PermKey } from "@/constants/permissions";

interface Props {
  /** Single required permission */
  permission?: PermKey;
  /** At least one of these permissions (OR logic) */
  anyOf?: PermKey[];
  /** Rendered when the check fails (default: null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the authenticated user satisfies the
 * permission check. Use `permission` for a single key or `anyOf` for OR logic.
 *
 * Owners always pass — their granularPermissions include everything.
 */
export default function RequirePermission({ permission, anyOf, fallback = null, children }: Props) {
  const user = useAuthStore((s) => s.user);

  // Owner bypass
  if (user?.role === "owner") return <>{children}</>;

  const allowed =
    (permission && hasPermission(user, permission)) ||
    (anyOf      && hasAnyPermission(user, anyOf));

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
