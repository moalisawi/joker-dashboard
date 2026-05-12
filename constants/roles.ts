export const ROLES = {
  OWNER:    "owner",
  ADMIN:    "admin",
  EMPLOYEE: "employee",
} as const;

export const EMPLOYEE_ROLES = {
  OWNER:    "owner",
  ADMIN:    "admin",
  SALES:    "sales",
  FOLLOWUP: "followup",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  owner:    "مالك",
  admin:    "مدير",
  employee: "موظف",
};

export const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
  owner:    "مالك",
  admin:    "مدير",
  sales:    "مبيعات",
  followup: "متابعة",
};

export const ROLE_HIERARCHY: Record<string, number> = {
  owner:    3,
  admin:    2,
  employee: 1,
};

export type RoleValue         = (typeof ROLES)[keyof typeof ROLES];
export type EmployeeRoleValue = (typeof EMPLOYEE_ROLES)[keyof typeof EMPLOYEE_ROLES];
