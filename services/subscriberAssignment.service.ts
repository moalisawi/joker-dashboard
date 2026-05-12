"use client";

/**
 * Subscriber Assignment Service (client-side helpers)
 *
 * All mutations go through /api/subscribers/assign (server-side) for:
 * - Admin SDK Firestore write (bypasses `if false` rules on subscribers)
 * - Proper role/permission validation
 * - Audit logging
 *
 * This service only provides the HTTP wrapper + reads.
 */

import { auth } from "@/lib/auth";
import type { AssignmentHistoryEntry } from "@/types";

export interface AssignPayload {
  subscriberId:             string;
  subscriberName:           string;
  assignedSalesId?:         string | null;
  assignedSalesName?:       string | null;
  assignedNutritionistId?:  string | null;
  assignedNutritionistName?:string | null;
  assignedTeamId?:          string | null;
  assignedTeamName?:        string | null;
  assignmentType:           string;
  reason?:                  string;
}

async function post<T = { success: boolean }>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized");
  const res = await fetch(path, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify(payload),
  });
  const data = await res.json() as T & { success?: boolean; error?: string };
  if (!res.ok || data.success === false) {
    throw new Error((data as { error?: string }).error ?? "Operation failed");
  }
  return data;
}

export const subscriberAssignmentService = {
  /** Assign / reassign a subscriber. All fields optional except subscriberId + assignmentType. */
  async assign(payload: AssignPayload): Promise<void> {
    await post("/api/subscribers/assign", payload as unknown as Record<string, unknown>);
  },

  /** Remove all assignment (set unassigned). */
  async unassign(subscriberId: string, subscriberName: string, reason?: string): Promise<void> {
    await post("/api/subscribers/assign", {
      subscriberId,
      subscriberName,
      assignedSalesId:          null,
      assignedSalesName:        null,
      assignedNutritionistId:   null,
      assignedNutritionistName: null,
      assignedTeamId:           null,
      assignedTeamName:         null,
      assignmentType:           "unassigned",
      reason,
    });
  },

  /** Get assignment history embedded in the subscriber document. */
  getHistory(subscriber: { assignmentHistory?: AssignmentHistoryEntry[] }): AssignmentHistoryEntry[] {
    return subscriber.assignmentHistory ?? [];
  },
};
