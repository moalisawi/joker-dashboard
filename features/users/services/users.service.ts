"use client";

/**
 * Users domain service.
 *
 * Centralises all employee/user business logic:
 * - Read operations hit Firestore directly via the client SDK.
 * - Write operations go through focused API routes (server-side validation).
 *
 * React Query hooks in features/users/hooks.ts wrap these methods.
 * Keep this service framework-agnostic (no React / Zustand imports).
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc} from "firebase/firestore";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import type { UserProfile } from "@/types";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DeactivateEmployeeInput,
  GranularPermissionsInput,
} from "@/features/users/schemas";

// ─── Internal: authenticated POST helper ──────────────────────────────────────

async function post<T = { success: boolean }>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as T & { success?: boolean; error?: string };
  if (!res.ok || data.success === false) {
    throw new Error((data as { error?: string }).error || "Operation failed");
  }
  return data;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export const usersFeatureService = {
  async getEmployees(): Promise<UserProfile[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.USERS),
        where("isEmployee", "==", true),
      )
    );
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
      .filter((e) => !e.deleted)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },

  async getActiveEmployees(): Promise<UserProfile[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.USERS),
        where("isEmployee", "==", true),
        where("active", "==", true),
      )
    );
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
      .filter((e) => !e.deleted)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },

  async getEmployeeById(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    return snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null;
  },

  // ─── Writes ────────────────────────────────────────────────────────────────

  /**
   * Create a brand-new Firebase Auth user + Firestore employee document.
   * Rollback is handled server-side: if the Firestore write fails the Auth
   * user is deleted before the error is surfaced.
   */
  async createEmployee(input: CreateEmployeeInput): Promise<{ uid: string }> {
    return post<{ uid: string }>("/api/employees/create", input);
  },

  /** Update employee role, department, team, phone, or notes. */
  async updateEmployee(input: UpdateEmployeeInput): Promise<void> {
    await post("/api/employees/update", input);
  },

  /** Assign (or remove) a team from an employee. */
  async assignTeam(uid: string, teamId: string | null): Promise<void> {
    await post("/api/employees/update", { uid, teamId });
  },

  /**
   * Deactivate an employee: sets status → "disabled", active → false.
   * Account and Firestore document are preserved (soft deactivation).
   */
  async deactivateEmployee(input: DeactivateEmployeeInput): Promise<void> {
    await post("/api/employees/deactivate", input);
  },

  /** Override the employee's granular permissions. Owner-only. */
  async updatePermissions(uid: string, permissions: GranularPermissionsInput): Promise<void> {
    await post("/api/employees/update", {
      uid,
      granularPermissions: permissions,
    });
  },

  /** Soft-delete an employee (owner-only). Marks deleted in Firestore + disables Auth. */
  async deleteEmployee(uid: string): Promise<void> {
    await post("/api/employees/delete", { uid });
  },
};
