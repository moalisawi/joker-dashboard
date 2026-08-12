import type { Role, Permissions } from "@/types";
import type { GranularPermissions, AccountStatus } from "@/types";
import type { EmployeeRole } from "@/types";
import { PERMISSION_DESCRIPTIONS } from "@/types/permissions";

// ─── Flat permissions (backward-compat) ────────────────────────────────────────

export const PERMISSIONS: Record<Role, Permissions> = {
  owner: {
    canViewAll:              true,
    canViewRevenue:          true,
    canCreate:               true,
    canEdit:                 true,
    canWithdraw:             true,
    canDelete:               true,
    canManageUsers:          true,
    canViewLogs:             true,
    canManagePaymentMethods: true,
  },
  admin: {
    canViewAll:              true,
    canViewRevenue:          true,
    canCreate:               true,
    canEdit:                 true,
    canWithdraw:             true,
    canDelete:               false,
    canManageUsers:          false,
    canViewLogs:             true,
    canManagePaymentMethods: true,
  },
  employee: {
    canViewAll:              false,
    canViewRevenue:          false,
    canCreate:               true,
    canEdit:                 true,
    canWithdraw:             false,
    canDelete:               false,
    canManageUsers:          false,
    canViewLogs:             false,
    canManagePaymentMethods: false,
  },
};

export function getPermissions(role: Role): Permissions {
  return PERMISSIONS[role] ?? PERMISSIONS.employee;
}

export function hasPermission(role: Role | undefined, name: keyof Permissions): boolean {
  if (!role) return false;
  return Boolean(PERMISSIONS[role]?.[name]);
}

// ─── The ceiling ───────────────────────────────────────────────────────────────
//
// Two independent things were being called a "role":
//
//   role     — authority: who may manage whom (owner / admin / employee)
//   jobRole  — occupation: what the person does (sales / followup / team_leader)
//
// Each had its own permission table and nothing said which one won. The tables
// disagreed, so a sales employee — the default for every new hire — could delete
// subscribers and refund payments while an admin could not. Whether a user got
// the job table or the role table depended on whether their document happened to
// carry `granularPermissions`.
//
// ROLE_CEILING settles it. It is the maximum any account at that authority level
// may hold, whatever their job preset or per-user overrides say. Effective
// permissions are the *intersection* of the ceiling with the grant, so a preset
// asking for more than the ceiling allows cannot raise anyone: the inversion is
// impossible by construction rather than by discipline.
//
// A ceiling is not a grant. JOB_PRESET decides what a person actually starts
// with; the ceiling only decides what they may never exceed.

export const ROLE_CEILING: Record<Role, GranularPermissions> = {
  owner: {
    subscribers:   { view: true,  create: true,  edit: true,   delete: true  },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: true },
    payments:      { create: true, edit: true,   refund: true  },
    analytics:     { view: true,  export: true   },
    logs:          { view: true   },
    users:         { manage: true, changeRoles: true, activateAccounts: true },
    settings:      { manage: true  },
  },

  // Full operational authority. Creating accounts and changing roles stay with
  // the owner; suspending or reactivating an existing account does not, since
  // that is day-to-day supervision rather than granting authority.
  admin: {
    subscribers:   { view: true,  create: true,  edit: true,   delete: true  },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: true },
    payments:      { create: true, edit: true,   refund: true  },
    analytics:     { view: true,  export: true   },
    logs:          { view: true   },
    users:         { manage: false, changeRoles: false, activateAccounts: true },
    settings:      { manage: true  },
  },

  // The three irreversible money actions — deleting a subscriber, refunding a
  // payment, withdrawing a subscription — are manager-level and above. Everything
  // else stays open at the ceiling so job presets can still differentiate:
  // a team leader reads analytics, a follow-up agent freezes, a salesperson does
  // neither, and none of them can be granted past this line.
  employee: {
    subscribers:   { view: true,  create: true,  edit: true,   delete: false },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: false },
    payments:      { create: true, edit: true,   refund: false },
    analytics:     { view: true,  export: true   },
    logs:          { view: true   },
    users:         { manage: false, changeRoles: false, activateAccounts: false },
    settings:      { manage: false },
  },
};

type PermissionMap = Record<string, Record<string, boolean>>;

/**
 * Both true wins. Any action the ceiling withholds is withheld, whatever the
 * grant claims; any action the grant does not ask for stays off.
 */
export function intersectPermissions(
  ceiling: GranularPermissions,
  grant: GranularPermissions
): GranularPermissions {
  const c = ceiling as unknown as PermissionMap;
  const g = grant as unknown as PermissionMap;
  const out: PermissionMap = {};

  for (const category of Object.keys(c)) {
    out[category] = {};
    for (const action of Object.keys(c[category])) {
      out[category][action] = c[category][action] === true && g?.[category]?.[action] === true;
    }
  }
  return out as unknown as GranularPermissions;
}

/**
 * What this account may actually do — the single answer, for the client, the
 * server, and anything else that asks.
 *
 * Grant order: an explicit per-user override, else the preset for their job,
 * else the role's own defaults. Whichever it is, the ceiling clamps it.
 */
export function effectivePermissions(user: {
  role: Role;
  employeeRole?: EmployeeRole | null;
  granularPermissions?: GranularPermissions | null;
}): GranularPermissions {
  const ceiling = ROLE_CEILING[user.role] ?? ROLE_CEILING.employee;
  const grant =
    user.granularPermissions ??
    (user.employeeRole ? EMPLOYEE_ROLE_PERMISSIONS[user.employeeRole] : undefined) ??
    DEFAULT_GRANULAR_PERMISSIONS[user.role] ??
    DEFAULT_GRANULAR_PERMISSIONS.employee;

  return intersectPermissions(ceiling, grant);
}

// ─── Granular permission defaults per role ─────────────────────────────────────

export const DEFAULT_GRANULAR_PERMISSIONS: Record<Role, GranularPermissions> = {
  // Owner and admin start at their ceiling. Keeping a separate, weaker default
  // for admin is what left a manager below their own staff even after the
  // ceiling was introduced: the admin default withheld subscribers.delete and
  // analytics.export, both of which the team_leader and sales presets grant.
  // An admin who needs less than the ceiling gets a per-user override.
  owner: ROLE_CEILING.owner,
  admin: ROLE_CEILING.admin,
  employee: {
    subscribers:   { view: true,  create: true,  edit: true,  delete: false },
    subscriptions: { renew: true, freeze: false, resume: false, withdraw: false },
    payments:      { create: true, edit: false,  refund: false },
    analytics:     { view: false, export: false  },
    logs:          { view: false  },
    users:         { manage: false, changeRoles: false, activateAccounts: false },
    settings:      { manage: false },
  },
};

export function getDefaultGranularPermissions(role: Role): GranularPermissions {
  return DEFAULT_GRANULAR_PERMISSIONS[role] ?? DEFAULT_GRANULAR_PERMISSIONS.employee;
}

/**
 * Check a single granular permission.
 * Falls back to role default when granularPermissions is absent.
 */
export function canDoGranular(
  role: Role,
  granularPermissions: GranularPermissions | undefined,
  category: keyof GranularPermissions,
  action: string,
  employeeRole?: EmployeeRole | null
): boolean {
  // Routed through effectivePermissions so the role ceiling applies here too.
  // Reading the stored grant directly was how a preset could out-grant the role.
  const gp = effectivePermissions({ role, employeeRole, granularPermissions });
  return Boolean((gp as unknown as Record<string, Record<string, boolean>>)[category]?.[action]);
}

/**
 * Derive the flat Permissions object from granular permissions.
 * Used to keep the existing can() interface fully working.
 */
export function granularToFlat(gp: GranularPermissions): Permissions {
  return {
    canViewAll:              gp.subscribers.view,
    canViewRevenue:          gp.analytics.view,
    canCreate:               gp.subscribers.create,
    canEdit:                 gp.subscribers.edit,
    canWithdraw:             gp.subscriptions.withdraw,
    canDelete:               gp.subscribers.delete,
    canManageUsers:          gp.users.manage,
    canViewLogs:             gp.logs.view,
    canManagePaymentMethods: gp.settings.manage,
  };
}

// ─── Account status helpers ────────────────────────────────────────────────────

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active:    "نشط",
  suspended: "معلق",
  disabled:  "معطل",
  pending:   "بانتظار التفعيل",
  deleted:   "مؤرشف",
};

/** Returns true if the status allows dashboard access */
export function isAccountAccessible(status: AccountStatus | undefined, active: boolean): boolean {
  if (status) return status === "active";
  return active === true;
}

/**
 * The one place that answers "what state is this account in?".
 *
 * Three fields have accumulated for the same question — `status`, the legacy
 * boolean `active`, and `deleted` — and they can disagree: the delete route
 * writes all three, the old toggle wrote only two, and accounts created before
 * `status` existed carry none. Reading them ad hoc is how the same person showed
 * as نشط in one list and معطل in another. `deleted` wins, then `status`, then
 * the boolean.
 */
export function resolveAccountStatus(user: {
  status?: AccountStatus | string;
  active?: boolean;
  deleted?: boolean;
}): AccountStatus {
  if (user.deleted) return "deleted";
  const s = user.status;
  if (s === "active" || s === "suspended" || s === "disabled" || s === "pending" || s === "deleted") {
    return s;
  }
  return user.active ? "active" : "disabled";
}

/** Statuses that keep a person in the working directory rather than the archive. */
export function isArchivedStatus(status: AccountStatus): boolean {
  return status === "deleted";
}

// ─── Readable permission summary ───────────────────────────────────────────────

/**
 * The effective permissions as a list of Arabic sentences.
 *
 * A 20-checkbox grid states what is stored; it does not state what the person
 * can do — least of all before you press Save on a new account. Both the create
 * modal and the profile page ask this function instead.
 */
export function describePermissions(user: {
  role: Role;
  employeeRole?: EmployeeRole | null;
  granularPermissions?: GranularPermissions | null;
}): string[] {
  const gp = effectivePermissions(user) as unknown as Record<string, Record<string, boolean>>;
  const out: string[] = [];
  for (const [category, actions] of Object.entries(gp)) {
    for (const [action, allowed] of Object.entries(actions)) {
      if (!allowed) continue;
      const text = PERMISSION_DESCRIPTIONS[`${category}.${action}`];
      if (text) out.push(text);
    }
  }
  return out;
}

// ─── Role metadata ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  owner:    "مالك",
  admin:    "مدير",
  employee: "موظف",
};

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner:    3,
  admin:    2,
  employee: 1,
};

/** Returns true if actor can manage target (actor must outrank target) */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin" && targetRole === "employee") return true;
  return false;
}

/** Returns true when the value is one of the three roles the system recognises. */
export function isKnownRole(value: unknown): value is Role {
  return value === "owner" || value === "admin" || value === "employee";
}

/**
 * Returns true if actor can assign the given role.
 *
 * `assignRole` is checked against the known set at runtime, not just by its TS
 * type: this value arrives from a request body, and the owner branch used to
 * return true for anything. Persisting an unrecognised role does not grant
 * access — firestore.rules only matches owner/admin/employee — but it silently
 * strips the account of every permission, which is worse than a rejection.
 */
export function canAssignRole(actorRole: Role, assignRole: Role): boolean {
  if (!isKnownRole(assignRole)) return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin" && assignRole === "employee") return true;
  return false;
}

// ─── Permissions per EmployeeRole ─────────────────────────────────────────────

export const EMPLOYEE_ROLE_PERMISSIONS: Record<EmployeeRole, GranularPermissions> = {
  owner:       DEFAULT_GRANULAR_PERMISSIONS.owner,
  admin:       DEFAULT_GRANULAR_PERMISSIONS.admin,
  team_leader: {
    subscribers:   { view: true,  create: true,  edit: true,  delete: false },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: false },
    payments:      { create: true, edit: false,  refund: false },
    analytics:     { view: true,  export: true   },
    logs:          { view: true   },
    users:         { manage: false, changeRoles: false, activateAccounts: false },
    settings:      { manage: false },
  },
  // This preset used to grant delete, refund and withdraw, and it is the default
  // for every employee created through the UI — so the standard new hire outranked
  // an admin. ROLE_CEILING.employee would clamp those away regardless; they are
  // removed here too so the preset states what it actually confers.
  sales: {
    subscribers:   { view: true,  create: true,  edit: true,  delete: false },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: false },
    payments:      { create: true, edit: true,   refund: false },
    analytics:     { view: true,  export: true   },
    logs:          { view: true   },
    users:         { manage: false, changeRoles: false, activateAccounts: false },
    settings:      { manage: false },
  },
  followup: {
    subscribers:   { view: true,  create: false, edit: true,  delete: false },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: false },
    payments:      { create: true, edit: false,  refund: false },
    analytics:     { view: false, export: false  },
    logs:          { view: false  },
    users:         { manage: false, changeRoles: false, activateAccounts: false },
    settings:      { manage: false },
  },
};

/** Map EmployeeRole → auth Role for the users collection */
export const EMPLOYEE_AUTH_ROLE: Record<EmployeeRole, Role> = {
  owner:       "owner",
  admin:       "admin",
  team_leader: "employee",
  sales:       "employee",
  followup:    "employee",
};

// ─── Static data ───────────────────────────────────────────────────────────────
// Employee names and team names are NOT hardcoded here.
// Use useEmployeeNames() hook and useTeams() hook instead — they read from Firestore.

export const PAYMENT_METHODS = [
  "PayPal",
  "محفظة موبايل",
  "زين كاش",
  "انستاباي",
  "ويسترن يونيون",
  "كريبتو / USDT",
  "فودافون كاش",
  "كاش",
  "حوالة بنكية",
  "حوالة بنكية بنك الداخل",
  "محفظة جوال باي",
  "محفظة بال باي",
] as const;

export const SOURCES = [
  "سوشيال ميديا",
  "ترشيح",
  "إعلان",
  "بحث",
  "أخرى",
] as const;
