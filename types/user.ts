import { Timestamp } from "firebase/firestore";
import type { AccountStatus, GranularPermissions } from "./permissions";
import type { EmployeeRole, EmployeeDepartment } from "./employee";

export type Role = "owner" | "admin" | "employee";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  employeeName?: string;
  role: Role;

  // Employee fields — present when isEmployee is true
  isEmployee?: boolean;
  employeeRole?: EmployeeRole;
  department?: EmployeeDepartment;
  notes?: string;

  /** Structured account status (replaces legacy boolean `active`) */
  status?: AccountStatus;
  /** Legacy boolean kept for backward compatibility — computed from `status` */
  active: boolean;

  phone?: string;
  teamId?: string;

  /** Optional granular permissions override; when absent, role defaults apply */
  granularPermissions?: GranularPermissions;

  deleted?: boolean;
  deletedAt?: string | Timestamp;
  deletedBy?: string;

  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
  lastLoginAt?: Timestamp;
}

export interface Permissions {
  canViewAll: boolean;
  canViewRevenue: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canWithdraw: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canViewLogs: boolean;
  canManagePaymentMethods: boolean;
}
