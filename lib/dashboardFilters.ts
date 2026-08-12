/**
 * Dashboard Filters — Role-Aware Selectors
 *
 * Pure selector functions that filter / shape data based on the viewing user's
 * role and team context. No React or Firestore imports — these are plain
 * functions consumed by hooks/components.
 *
 * Usage:
 *   const visible = getDashboardSubscribers(allSubscribers, user);
 */

import type { UserProfile } from "@/types";
import type { Subscriber }  from "@/types";

// ─── Subscriber visibility ────────────────────────────────────────────────────

/**
 * Returns subscribers the user is allowed to see on their dashboard:
 * - owner / admin → all subscribers
 * - sales employee → subscribers they directly convinced OR are assigned to them
 * - nutrition employee → subscribers assigned to them or their team
 */
export function getDashboardSubscribers(
  subscribers: Subscriber[],
  user: UserProfile | null
): Subscriber[] {
  if (!user) return [];

  if (user.role === "owner" || user.role === "admin") return subscribers;

  const employeeName = user.employeeName ?? user.name ?? "";
  const teamId       = user.teamId ?? null;

  return subscribers.filter((s) => {
    if (s.assignedSalesId         === user.uid)  return true;
    if (s.assignedNutritionistId  === user.uid)  return true;
    if (teamId && s.assignedTeamId === teamId)   return true;
    if (s.convincedBy === employeeName)          return true;
    return false;
  });
}

// ─── Renewals visibility ──────────────────────────────────────────────────────

/** Subscribers with renewals the current user should act on. */
export function getDashboardRenewals(
  subscribers: Subscriber[],
  user: UserProfile | null
): Subscriber[] {
  const visible = getDashboardSubscribers(subscribers, user);

  // Sales and owner see renewal pipeline; nutrition team members do not typically manage renewals
  if (user?.employeeRole === "followup") return [];

  return visible.filter(
    (s) => s.renewalWorkflowStatus === "pending" || s.renewalWorkflowStatus === "contacted"
  );
}

// ─── Pending installments ─────────────────────────────────────────────────────

/** Subscribers with outstanding balance (sales focus). */
export function getDashboardPendingInstallments(
  subscribers: Subscriber[],
  user: UserProfile | null
): Subscriber[] {
  const visible = getDashboardSubscribers(subscribers, user);
  return visible.filter((s) => (s.remainingAmountUSD ?? 0) > 0 && s.subscriptionState === "active");
}

// ─── Expiring soon ────────────────────────────────────────────────────────────

/** Active subscribers expiring within `days` days that the user can see. */
export function getDashboardExpiringSoon(
  subscribers: Subscriber[],
  user: UserProfile | null,
  days = 15
): Subscriber[] {
  const visible = getDashboardSubscribers(subscribers, user);
  return visible.filter(
    (s) => s.subscriptionState === "active" && (s.daysRemaining ?? 999) <= days && (s.daysRemaining ?? 0) >= 0
  );
}

// ─── Role-aware widget visibility ────────────────────────────────────────────

export type DashboardWidgets = {
  showRevenue:           boolean;
  showAnalytics:         boolean;
  showAllSubscribers:    boolean;
  showRenewals:          boolean;
  showInstallments:      boolean;
  showTeamPerformance:   boolean;
  showEmployeeManagement:boolean;
  showMyAssigned:        boolean;
  showLogs:              boolean;
};

/**
 * Returns a widget visibility map based on the user's role and permissions.
 * Lets the dashboard page decide which sections to render without sprinkling
 * role checks everywhere.
 */
export function getDashboardWidgets(user: UserProfile | null): DashboardWidgets {
  if (!user) {
    return {
      showRevenue:           false,
      showAnalytics:         false,
      showAllSubscribers:    false,
      showRenewals:          false,
      showInstallments:      false,
      showTeamPerformance:   false,
      showEmployeeManagement:false,
      showMyAssigned:        false,
      showLogs:              false,
    };
  }

  const gp   = user.granularPermissions;
  const role = user.role;
  const dept = user.employeeRole;

  const isOwner  = role === "owner";
  const isAdmin  = role === "owner" || role === "admin";
  const isSales  = dept === "sales";

  return {
    showRevenue:            isAdmin || (gp?.analytics?.view ?? false),
    showAnalytics:          isAdmin || (gp?.analytics?.view ?? false),
    showAllSubscribers:     isAdmin,
    // The third clause used to be `|| gp.subscriptions.manageRenewals`, a
    // permission nothing could ever store — absent from ROLE_CEILING and
    // stripped by the save schema — so it was dead code that always evaluated
    // false. Removing it is exactly a no-op.
    //
    // Deliberately NOT replaced with `gp.subscriptions.renew`: that reads like
    // the natural substitute, but the employee preset grants renew, so it would
    // silently add the renewals section to every follow-up agent's dashboard.
    // Widening who sees what on the dashboard is a product decision and has
    // nothing to do with user management.
    showRenewals:           isOwner || isSales,
    showInstallments:       isOwner || isSales,
    showTeamPerformance:    isAdmin,
    showEmployeeManagement: isAdmin || (gp?.users?.manage ?? false),
    showMyAssigned:         !isAdmin,
    showLogs:               isAdmin || (gp?.logs?.view ?? false),
  };
}

// ─── Role label helpers ───────────────────────────────────────────────────────

export function getDashboardTitle(user: UserProfile | null): string {
  if (!user) return "لوحة التحكم";
  if (user.role === "owner") return "لوحة المالك";
  if (user.employeeRole === "sales")    return "لوحة المبيعات";
  if (user.employeeRole === "followup") return "لوحة المتابعة التغذوية";
  if (user.employeeRole === "admin")    return "لوحة الإدارة";
  return "لوحة التحكم";
}
