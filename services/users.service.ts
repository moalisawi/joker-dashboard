/**
 * User Service
 * Handle all user and authentication-related business logic
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { auth } from "@/lib/auth";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import { UserProfile, Permissions, Role } from "@/types";

export const userService = {
  /**
   * Get all users
   */
  async getAll(): Promise<UserProfile[]> {
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },

  /**
   * Get user by UID
   */
  async getById(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists()
      ? ({ uid: docSnap.id, ...docSnap.data() } as UserProfile)
      : null;
  },

  /**
   * Get users by role
   */
  async getByRole(role: Role): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },

  /**
   * Get active users only
   */
  async getActive(): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("active", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserProfile[];
  },

  /**
   * Create new user
   */
  async create(
    email: string,
    password: string,
    profile: Omit<UserProfile, "uid">
  ): Promise<string> {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const uid = userCredential.user.uid;

    // Update Auth profile
    await updateProfile(userCredential.user, {
      displayName: profile.name,
    });

    // Create Firestore document
    await setDoc(doc(db, "users", uid), {
      ...profile,
      email,
      uid,
      active: true,
      createdAt: serverTimestamp(),
    });

    return uid;
  },

  /**
   * Update user profile
   */
  async update(uid: string, data: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Deactivate user (soft delete)
   */
  async deactivate(uid: string): Promise<void> {
    await this.update(uid, { active: false });
  },

  /**
   * Reactivate user
   */
  async reactivate(uid: string): Promise<void> {
    await this.update(uid, { active: true });
  },

  /**
   * Delete user completely (hard delete)
   */
  async delete(uid: string): Promise<void> {
    // Get Firebase Auth user
    const userCredential = await getDoc(doc(db, "users", uid));
    if (!userCredential.exists()) {
      throw new Error("User not found");
    }

    // Delete Firestore document first
    await deleteDoc(doc(db, "users", uid));

    // Then delete Auth user if needed (requires admin SDK in real scenario)
    // This is a client-side limitation — use Cloud Function for complete deletion
  },

  /**
   * Get user permissions
   */
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

  /**
   * Check if user can perform action
   */
  async canPerformAction(uid: string, action: keyof Permissions): Promise<boolean> {
    const user = await this.getById(uid);
    if (!user) return false;

    const permissions = await this.getPermissions(user.role);
    return permissions[action] ?? false;
  },

  /**
   * Get employees only (for team assignments)
   */
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
