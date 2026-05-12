/**
 * User Service
 * Read-side helpers plus protected account mutations.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { callUserOperation } from "@/lib/clientUserOperations";
import { UserProfile, Permissions, Role } from "@/types";

export const userService = {
  async getAll(): Promise<UserProfile[]> {
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },

  async getById(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists()
      ? ({ uid: docSnap.id, ...docSnap.data() } as UserProfile)
      : null;
  },

  async getByRole(role: Role): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },

  async getActive(): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("active", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },

  async create(
    email: string,
    password: string,
    profile: Omit<UserProfile, "uid">
  ): Promise<string> {
    void email;
    void password;
    void profile;
    throw new Error("User creation must happen through the protected onboarding flow.");
  },

  async update(uid: string, data: Partial<UserProfile>): Promise<void> {
    await callUserOperation("updateProfile", {
      targetUid: uid,
      data,
    });
  },

  async deactivate(uid: string): Promise<void> {
    await callUserOperation("setStatus", {
      targetUid: uid,
      newStatus: "disabled",
    });
  },

  async reactivate(uid: string): Promise<void> {
    await callUserOperation("setStatus", {
      targetUid: uid,
      newStatus: "active",
    });
  },

  async delete(uid: string): Promise<void> {
    void uid;
    throw new Error("Hard deleting users is disabled. Use account status changes instead.");
  },

  async getPermissions(role: Role): Promise<Permissions> {
    const permissionMap: Record<Role, Permissions> = {
      owner: {
        canViewAll: true,
        canViewRevenue: true,
        canCreate: true,
        canEdit: true,
        canWithdraw: true,
        canDelete: true,
        canManageUsers: true,
        canViewLogs: true,
      },
      admin: {
        canViewAll: true,
        canViewRevenue: true,
        canCreate: true,
        canEdit: true,
        canWithdraw: true,
        canDelete: true,
        canManageUsers: false,
        canViewLogs: true,
      },
      employee: {
        canViewAll: false,
        canViewRevenue: false,
        canCreate: true,
        canEdit: false,
        canWithdraw: false,
        canDelete: false,
        canManageUsers: false,
        canViewLogs: false,
      },
    };

    return permissionMap[role];
  },

  async canPerformAction(uid: string, action: keyof Permissions): Promise<boolean> {
    const user = await this.getById(uid);
    if (!user) return false;

    const permissions = await this.getPermissions(user.role);
    return permissions[action] ?? false;
  },

  async getEmployees(): Promise<UserProfile[]> {
    const q = query(
      collection(db, "users"),
      where("role", "==", "employee"),
      where("active", "==", true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },
};
