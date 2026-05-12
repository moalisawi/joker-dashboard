import type { Role, Permissions } from "@/types";
import type { GranularPermissions, AccountStatus } from "@/types";
import type { EmployeeRole } from "@/types";

// ─── Flat permissions (backward-compat) ────────────────────────────────────────

export const PERMISSIONS: Record<Role, Permissions> = {
  owner: {
    canViewAll:     true,
    canViewRevenue: true,
    canCreate:      true,
    canEdit:        true,
    canWithdraw:    true,
    canDelete:      true,
    canManageUsers: true,
    canViewLogs:    true,
  },
  admin: {
    canViewAll:     true,
    canViewRevenue: true,
    canCreate:      true,
    canEdit:        true,
    canWithdraw:    true,
    canDelete:      false,
    canManageUsers: false,
    canViewLogs:    true,
  },
  employee: {
    canViewAll:     false,
    canViewRevenue: false,
    canCreate:      true,
    canEdit:        true,
    canWithdraw:    false,
    canDelete:      false,
    canManageUsers: false,
    canViewLogs:    false,
  },
};

export function getPermissions(role: Role): Permissions {
  return PERMISSIONS[role] ?? PERMISSIONS.employee;
}

export function hasPermission(role: Role | undefined, name: keyof Permissions): boolean {
  if (!role) return false;
  return Boolean(PERMISSIONS[role]?.[name]);
}

// ─── Granular permission defaults per role ─────────────────────────────────────

export const DEFAULT_GRANULAR_PERMISSIONS: Record<Role, GranularPermissions> = {
  owner: {
    subscribers:   { view: true,  create: true,  edit: true,  delete: true  },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: true },
    payments:      { create: true, edit: true,   refund: true  },
    analytics:     { view: true,  export: true   },
    logs:          { view: true   },
    users:         { manage: true, changeRoles: true, activateAccounts: true },
    settings:      { manage: true  },
  },
  admin: {
    subscribers:   { view: true,  create: true,  edit: true,  delete: false },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: true },
    payments:      { create: true, edit: true,   refund: true  },
    analytics:     { view: true,  export: false  },
    logs:          { view: true   },
    users:         { manage: false, changeRoles: false, activateAccounts: true },
    settings:      { manage: false },
  },
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
  action: string
): boolean {
  const gp = granularPermissions ?? DEFAULT_GRANULAR_PERMISSIONS[role];
  return Boolean((gp as unknown as Record<string, Record<string, boolean>>)[category]?.[action]);
}

/**
 * Derive the flat Permissions object from granular permissions.
 * Used to keep the existing can() interface fully working.
 */
export function granularToFlat(gp: GranularPermissions): Permissions {
  return {
    canViewAll:     gp.subscribers.view,
    canViewRevenue: gp.analytics.view,
    canCreate:      gp.subscribers.create,
    canEdit:        gp.subscribers.edit,
    canWithdraw:    gp.subscriptions.withdraw,
    canDelete:      gp.subscribers.delete,
    canManageUsers: gp.users.manage,
    canViewLogs:    gp.logs.view,
  };
}

// ─── Account status helpers ────────────────────────────────────────────────────

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active:    "نشط",
  suspended: "معلق",
  disabled:  "معطل",
  pending:   "معلق التفعيل",
};

/** Returns true if the status allows dashboard access */
export function isAccountAccessible(status: AccountStatus | undefined, active: boolean): boolean {
  if (status) return status === "active";
  return active === true;
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

/** Returns true if actor can assign the given role */
export function canAssignRole(actorRole: Role, assignRole: Role): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin" && assignRole === "employee") return true;
  return false;
}

// ─── Permissions per EmployeeRole ─────────────────────────────────────────────

export const EMPLOYEE_ROLE_PERMISSIONS: Record<EmployeeRole, GranularPermissions> = {
  owner: DEFAULT_GRANULAR_PERMISSIONS.owner,
  admin: DEFAULT_GRANULAR_PERMISSIONS.admin,
  sales: {
    subscribers:   { view: true,  create: true,  edit: true,  delete: true  },
    subscriptions: { renew: true, freeze: true,  resume: true, withdraw: true },
    payments:      { create: true, edit: true,   refund: true  },
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
  owner:    "owner",
  admin:    "admin",
  sales:    "employee",
  followup: "employee",
};

// ─── Static data ───────────────────────────────────────────────────────────────

export const EMPLOYEES = ["حنان", "ميار", "ميدو"] as const;
export type EmployeeName = (typeof EMPLOYEES)[number];

export const TEAMS = ["فريق الشباب", "فريق البنات", "عبدالله طلبة"] as const;
export type TeamName = (typeof TEAMS)[number];

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
