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
  ReactivateEmployeeInput,
  ArchiveEmployeeInput,
  TransferDataInput,
  GranularPermissionsInput,
} from "@/features/users/schemas";
import type { UserImpact } from "@/lib/userImpact.types";

// ─── Internal: authenticated POST helper ──────────────────────────────────────

/**
 * An API error that kept the machine-readable part.
 *
 * The archive route answers 409/ASSIGNMENTS_PENDING when an account still has
 * work attached — a refusal the caller can act on by offering the transfer or
 * the acknowledgement again. Flattening every failure to `new Error(message)`
 * threw that away, leaving the dialog to string-match Arabic prose to tell a
 * recoverable refusal from a real fault.
 */
export class UserOperationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "UserOperationError";
  }
}

async function post<T = { success: boolean }>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new UserOperationError("Unauthorized", 401);

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as T & { success?: boolean; error?: string; code?: string };
  if (!res.ok || data.success === false) {
    throw new UserOperationError(data.error || "Operation failed", res.status, data.code);
  }
  return data;
}

/** What the lifecycle routes report back about the Firebase Auth side. */
export interface AccessRevocationResult {
  authDisabled?: boolean;
  tokensRevoked?: boolean;
  needsAttention?: boolean;
  authEnabled?: boolean;
  clearedTeamLeadership?: string[];
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export const usersFeatureService = {
  /**
   * Every account in the directory, employee or not, archived or not.
   *
   * getEmployees() filters on `isEmployee == true` and drops soft-deleted rows,
   * which made it the wrong source for a management console: owners and admins
   * created before that flag existed were simply missing from the page meant to
   * administer them, and an archived account could not be found to restore.
   * Filtering is the caller's job here.
   *
   * firestore.rules allows `/users` reads for staff, which is the same bar the
   * console itself requires (canReadUserDirectory).
   */
  async getAllUsers(): Promise<UserProfile[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.USERS));
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ar"));
  },

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
  async deactivateEmployee(input: DeactivateEmployeeInput): Promise<AccessRevocationResult> {
    return post<AccessRevocationResult>("/api/employees/deactivate", input);
  },

  /** Override the employee's granular permissions. Owner-only. */
  async updatePermissions(uid: string, permissions: GranularPermissionsInput): Promise<void> {
    await post("/api/employees/update", {
      uid,
      granularPermissions: permissions,
    });
  },

  /** Restore a disabled, suspended, pending or archived account. */
  async reactivateEmployee(input: ReactivateEmployeeInput): Promise<AccessRevocationResult> {
    return post<AccessRevocationResult>("/api/employees/reactivate", input);
  },

  /**
   * Archive an employee (owner-only). Soft — the uid and the document stay so
   * historical records keep resolving; Firebase Auth is disabled and its
   * refresh tokens revoked.
   */
  async archiveEmployee(input: ArchiveEmployeeInput): Promise<AccessRevocationResult> {
    return post<AccessRevocationResult>("/api/employees/delete", input);
  },

  /** What is still attached to this account. Read-only; safe to call on open. */
  async getImpact(uid: string): Promise<UserImpact> {
    const res = await post<{ impact: UserImpact }>("/api/employees/impact", { uid });
    return res.impact;
  },

  /** Hand assigned subscribers and leads from one employee to another. */
  async transferData(input: TransferDataInput): Promise<{ total: number }> {
    return post<{ total: number }>("/api/employees/transfer-data", input);
  },
};
