/**
 * Permission Service
 * Centralised logic for role management, account status changes, and granular permissions.
 * All mutations are validated server-side (role hierarchy enforced here + Firestore rules).
 */

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { writeAuditLog } from "@/lib/auditLog";
import {
  canManageRole,
  canAssignRole,
  getDefaultGranularPermissions,
} from "@/lib/permissions";
import type { UserProfile, Role, AccountStatus, GranularPermissions } from "@/types";

function makeActor(actor: UserProfile): UserProfile {
  return actor;
}

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

    await updateDoc(doc(db, "users", targetUid), {
      status:    newStatus,
      active:    newStatus === "active",
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });

    await writeAuditLog(makeActor(actor), `account_${newStatus}` as string, {
      targetType: "user",
      targetId:   targetUid,
      summary:    `تغيير حالة الحساب إلى: ${newStatus}${reason ? ` — ${reason}` : ""}`,
      metadata:   { newStatus, reason },
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

    // Reset granular permissions to the new role's defaults
    const defaultGranular = getDefaultGranularPermissions(newRole);

    await updateDoc(doc(db, "users", targetUid), {
      role:                newRole,
      granularPermissions: defaultGranular,
      updatedAt:           serverTimestamp(),
      updatedBy:           actor.uid,
    });

    await writeAuditLog(makeActor(actor), "role_changed", {
      targetType: "user",
      targetId:   targetUid,
      summary:    `تغيير الدور: ${targetCurrentRole} → ${newRole}`,
      metadata:   { previousRole: targetCurrentRole, newRole },
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

    await updateDoc(doc(db, "users", targetUid), {
      granularPermissions: permissions,
      updatedAt:           serverTimestamp(),
      updatedBy:           actor.uid,
    });

    await writeAuditLog(makeActor(actor), "permissions_updated", {
      targetType: "user",
      targetId:   targetUid,
      summary:    "تم تحديث الصلاحيات التفصيلية",
      metadata:   { permissions },
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

    const defaults = getDefaultGranularPermissions(targetRole);
    await updateDoc(doc(db, "users", targetUid), {
      granularPermissions: defaults,
      updatedAt:           serverTimestamp(),
      updatedBy:           actor.uid,
    });

    await writeAuditLog(makeActor(actor), "permissions_reset", {
      targetType: "user",
      targetId:   targetUid,
      summary:    `إعادة تعيين صلاحيات الدور: ${targetRole}`,
    });
  },

  /** Update basic profile fields (name, employeeName) */
  async updateProfile(
    actor: UserProfile,
    targetUid: string,
    data: { name?: string; employeeName?: string }
  ): Promise<void> {
    await updateDoc(doc(db, "users", targetUid), {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });

    await writeAuditLog(makeActor(actor), "user_updated", {
      targetType: "user",
      targetId:   targetUid,
      summary:    `تحديث بيانات المستخدم`,
      metadata:   data,
    });
  },
};
