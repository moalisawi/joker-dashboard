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
  assign_subscribers:    (gp) => gp.subscribers.assign ?? gp.subscribers.edit, // explicit or fallback to edit

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
  manage_settings:          (gp) => gp.settings.manage,

  // Analytics + Reports (Phase 4)
  view_analytics:          (gp) => gp.analytics.view,
  view_financial_reports:  (gp) => gp.analytics.view,
  export_reports:          (gp) => gp.analytics.export,
  manage_automations:      (gp) => gp.settings.manage,

  // Subscriber workflow (Phase 3) — optional fields default to false
  // assign_subscribers is already defined above (updated mapping)
  transfer_subscribers:      (gp) => gp.subscribers.transfer     ?? false,
  change_subscriber_status:  (gp) => gp.subscribers.changeStatus ?? false,
  view_internal_notes:       (gp) => gp.subscribers.viewNotes    ?? false,
  add_internal_notes:        (gp) => gp.subscribers.addNotes     ?? false,
  manage_renewals:           (gp) => gp.subscriptions.manageRenewals ?? false,
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

// Analytics + Reports (Phase 4)
export const canViewAnalytics        = (u: UserProfile | null) => hasPermission(u, "view_analytics");
export const canViewFinancialReports = (u: UserProfile | null) => hasPermission(u, "view_financial_reports");
export const canExportReports        = (u: UserProfile | null) => hasPermission(u, "export_reports");
export const canManageAutomations    = (u: UserProfile | null) => hasPermission(u, "manage_automations");

// ─── Role-based guards that mirror firestore.rules exactly ────────────────────
//
// firestore.rules is the authority: whatever it refuses, the UI must not offer.
// The guards below are deliberately NOT expressed as granular permissions,
// because the matching rule is written in terms of the role itself — granting
// someone the permission would light up buttons that Firestore then rejects
// with permission-denied.
//
// Keep each guard and the rule it mirrors in step. If a rule is widened, widen
// the guard here rather than adding a role check inside a component.

/** Mirrors `match /loginSessions` + `match /failedLogins` → `allow read: if isStaff()`. */
export const canViewSessions = (u: UserProfile | null): boolean =>
  u?.role === "owner" || u?.role === "admin";

/**
 * Mirrors `match /teams` → `allow create, update: if isOwner()`.
 *
 * Team writes were previously gated on canManageUsers (users.manage), which the
 * owner can delegate to an admin or an employee. Anyone holding it saw the
 * create / rename / deactivate controls and hit permission-denied on save.
 */
export const canManageTeams = (u: UserProfile | null): boolean =>
  u?.role === "owner";

/** Mirrors `match /teams` → `allow delete: if false` (delete is a soft-delete update). */
export const canDeleteTeams = (u: UserProfile | null): boolean =>
  u?.role === "owner";

/**
 * Mirrors `match /users` → `allow read: if isAuth() && (self || isStaff())`.
 *
 * Any page that lists *other* users needs this. Holding users.manage is not
 * enough: an employee granted it could open the page but every query for the
 * directory would be denied.
 */
export const canReadUserDirectory = (u: UserProfile | null): boolean =>
  u?.role === "owner" || u?.role === "admin";

// Subscriber workflow (Phase 3)
export const canAssignSubscribers       = (u: UserProfile | null) => hasPermission(u, "assign_subscribers");
export const canTransferSubscribers     = (u: UserProfile | null) => hasPermission(u, "transfer_subscribers");
export const canChangeSubscriberStatus  = (u: UserProfile | null) => hasPermission(u, "change_subscriber_status");
export const canViewInternalNotes       = (u: UserProfile | null) => hasPermission(u, "view_internal_notes");
export const canAddInternalNotes        = (u: UserProfile | null) => hasPermission(u, "add_internal_notes");
export const canManageRenewals          = (u: UserProfile | null) => hasPermission(u, "manage_renewals");
