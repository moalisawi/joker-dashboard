import { Timestamp } from "firebase/firestore";
import type { AccountStatus, GranularPermissions } from "./permissions";

export type Role = "owner" | "admin" | "employee";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  employeeName?: string;
  role: Role;

  /** Structured account status (replaces legacy boolean `active`) */
  status?: AccountStatus;
  /** Legacy boolean kept for backward compatibility — computed from `status` */
  active: boolean;

  /** Optional granular permissions override; when absent, role defaults apply */
  granularPermissions?: GranularPermissions;

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
}
