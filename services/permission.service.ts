/**
 * Permission Service
 * Centralised logic for role management, account status changes, and granular permissions.
 * All mutations are validated server-side (role hierarchy enforced here + Firestore rules).
 */

import { callUserOperation } from "@/lib/clientUserOperations";
import {
  canManageRole,
  canAssignRole,
} from "@/lib/permissions";
import type { UserProfile, Role, AccountStatus, GranularPermissions } from "@/types";

export const permissionService = {
  /**
   * Change a user's account status (active / suspended / disabled / pending).
   * Owners are protected — only another owner can change an owner's status.
   */
  async setStatus(
    actor: UserProfile,
    targetUid: string,
    targetRole: Role,
    newStatus: AccountStatus,
    reason?: string
  ): Promise<void> {
    if (!canManageRole(actor.role, targetRole)) {
      throw new Error("ليس لديك صلاحية لتغيير حالة هذا المستخدم");
    }
    if (actor.uid === targetUid) {
      throw new Error("لا يمكنك تغيير حالة حسابك الخاص");
    }

    await callUserOperation("setStatus", {
      targetUid,
      newStatus,
      reason,
    });
  },

  /**
   * Change a user's role.
   * Owners can assign any role; admins can only promote employees or demote admins to employee.
   */
  async setRole(
    actor: UserProfile,
    targetUid: string,
    targetCurrentRole: Role,
    newRole: Role
  ): Promise<void> {
    if (!canManageRole(actor.role, targetCurrentRole)) {
      throw new Error("ليس لديك صلاحية لإدارة هذا المستخدم");
    }
    if (!canAssignRole(actor.role, newRole)) {
      throw new Error("ليس لديك صلاحية لمنح هذا الدور");
    }
    if (actor.uid === targetUid) {
      throw new Error("لا يمكنك تغيير دور حسابك الخاص");
    }

    await callUserOperation("setRole", {
      targetUid,
      newRole,
    });
  },

  /**
   * Update granular permissions for a specific user.
   * Only owners can manage granular permissions.
   */
  async setGranularPermissions(
    actor: UserProfile,
    targetUid: string,
    permissions: GranularPermissions
  ): Promise<void> {
    if (actor.role !== "owner") {
      throw new Error("إدارة الصلاحيات التفصيلية متاحة للمالك فقط");
    }
    if (actor.uid === targetUid) {
      throw new Error("لا يمكنك تعديل صلاحيات حسابك الخاص");
    }

    await callUserOperation("setGranularPermissions", {
      targetUid,
      permissions: permissions as unknown as Record<string, unknown>,
    });
  },

  /**
   * Reset a user's granular permissions back to their role's defaults.
   */
  async resetPermissionsToRoleDefaults(
    actor: UserProfile,
    targetUid: string,
    targetRole: Role
  ): Promise<void> {
    if (actor.role !== "owner") {
      throw new Error("إعادة تعيين الصلاحيات متاحة للمالك فقط");
    }

    await callUserOperation("resetPermissions", {
      targetUid,
      targetRole,
    });
  },

  /** Update basic profile fields (name, employeeName) */
  async updateProfile(
    actor: UserProfile,
    targetUid: string,
    data: { name?: string; employeeName?: string }
  ): Promise<void> {
    await callUserOperation("updateProfile", {
      targetUid,
      data,
    });
  },
};
