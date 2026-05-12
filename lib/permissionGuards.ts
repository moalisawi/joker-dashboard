/**
 * Permission Guards
 *
 * Flat string → GranularPermissions bridge.
 * Provides both generic helpers (hasPermission, hasAnyPermission)
 * and semantic shortcuts (canManageUsers, canRefundPayments …)
 * so UI components and API routes share identical authorization logic.
 */

import type { UserProfile, GranularPermissions } from "@/types";
import { getDefaultGranularPermissions } from "@/lib/permissions";
import type { PermKey } from "@/constants/permissions";

// ─── Internal: resolve effective GranularPermissions for a user ───────────────

function resolveGP(user: UserProfile): GranularPermissions {
  return user.granularPermissions ?? getDefaultGranularPermissions(user.role);
}

// ─── Flat string → GranularPermissions check map ─────────────────────────────

const PERM_MAP: Record<PermKey, (gp: GranularPermissions) => boolean> = {
  // Subscribers
  view_subscribers:      (gp) => gp.subscribers.view,
  create_subscribers:    (gp) => gp.subscribers.create,
  edit_subscribers:      (gp) => gp.subscribers.edit,
  delete_subscribers:    (gp) => gp.subscribers.delete,
  assign_subscribers:    (gp) => gp.subscribers.edit,   // assigning maps to edit

  // Subscriptions
  renew_subscriptions:   (gp) => gp.subscriptions.renew,
  freeze_subscriptions:  (gp) => gp.subscriptions.freeze,
  resume_subscriptions:  (gp) => gp.subscriptions.resume,
  withdraw_subscriptions:(gp) => gp.subscriptions.withdraw,

  // Payments
  create_payments:       (gp) => gp.payments.create,
  review_payments:       (gp) => gp.payments.edit,
  refund_payments:       (gp) => gp.payments.refund,

  // Analytics
  view_revenue:          (gp) => gp.analytics.view,
  export_analytics:      (gp) => gp.analytics.export,

  // Logs
  view_logs:             (gp) => gp.logs.view,

  // Users
  manage_users:          (gp) => gp.users.manage,
  manage_permissions:    (gp) => gp.users.changeRoles,
  activate_accounts:     (gp) => gp.users.activateAccounts,

  // Settings
  manage_settings:       (gp) => gp.settings.manage,
};

// ─── Generic guards ───────────────────────────────────────────────────────────

/** Returns true if `user` holds the given permission key. */
export function hasPermission(user: UserProfile | null, key: PermKey): boolean {
  if (!user) return false;
  return PERM_MAP[key]?.(resolveGP(user)) ?? false;
}

/** Returns true if `user` holds at least one of the given permission keys. */
export function hasAnyPermission(user: UserProfile | null, keys: PermKey[]): boolean {
  if (!user || keys.length === 0) return false;
  const gp = resolveGP(user);
  return keys.some((k) => PERM_MAP[k]?.(gp) ?? false);
}

/** Returns true if `user` holds every one of the given permission keys. */
export function hasAllPermissions(user: UserProfile | null, keys: PermKey[]): boolean {
  if (!user || keys.length === 0) return false;
  const gp = resolveGP(user);
  return keys.every((k) => PERM_MAP[k]?.(gp) ?? false);
}

// ─── Semantic helpers ─────────────────────────────────────────────────────────
// Prefer these in components and API routes — they document intent clearly.

export const canManageUsers      = (u: UserProfile | null) => hasPermission(u, "manage_users");
export const canManagePermissions= (u: UserProfile | null) => hasPermission(u, "manage_permissions");
export const canActivateAccounts = (u: UserProfile | null) => hasPermission(u, "activate_accounts");

export const canViewSubscribers  = (u: UserProfile | null) => hasPermission(u, "view_subscribers");
export const canCreateSubscribers= (u: UserProfile | null) => hasPermission(u, "create_subscribers");
export const canEditSubscribers  = (u: UserProfile | null) => hasPermission(u, "edit_subscribers");
export const canDeleteSubscribers= (u: UserProfile | null) => hasPermission(u, "delete_subscribers");

export const canRenewSubscriptions = (u: UserProfile | null) => hasPermission(u, "renew_subscriptions");
export const canFreezeSubscriptions= (u: UserProfile | null) => hasPermission(u, "freeze_subscriptions");

export const canCreatePayments   = (u: UserProfile | null) => hasPermission(u, "create_payments");
export const canReviewPayments   = (u: UserProfile | null) => hasPermission(u, "review_payments");
export const canRefundPayments   = (u: UserProfile | null) => hasPermission(u, "refund_payments");

export const canViewRevenue      = (u: UserProfile | null) => hasPermission(u, "view_revenue");
export const canExportAnalytics  = (u: UserProfile | null) => hasPermission(u, "export_analytics");
export const canViewLogs         = (u: UserProfile | null) => hasPermission(u, "view_logs");
export const canManageSettings   = (u: UserProfile | null) => hasPermission(u, "manage_settings");
