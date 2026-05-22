"use client";

/**
 * Subscriber Assignment Feature Service
 *
 * Mutations → /api/subscribers/assign  (server-side auth + Firestore write)
 *   The API route writes both the subscriber document update AND the
 *   immutable subscriberAssignments history record via Admin SDK.
 * History reads → Firestore client SDK  (subscriberAssignments collection)
 */

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db }          from "@/lib/firestore";
import { auth }        from "@/lib/auth";
import { COLLECTIONS } from "@/constants/collections";
import { ASSIGNMENT_TYPE } from "@/constants/subscriberWorkflow";
import type { AssignSubscriberInput } from "@/features/subscriberAssignments/schemas";
import type { SubscriberAssignmentRecord } from "@/features/subscriberAssignments/types";
import type { Subscriber } from "@/types";

// ─── HTTP helper ──────────────────────────────────────────────────────────────

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
  const data = (await res.json()) as T & { success?: boolean; error?: string };
  if (!res.ok || data.success === false) {
    throw new Error((data as { error?: string }).error ?? "Operation failed");
  }
  return data;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const assignmentService = {
  /**
   * Assign a subscriber. Creates the API-side subscriber update and writes
   * an immutable history record to `subscriberAssignments`.
   */
  async assignSubscriber(
    input: AssignSubscriberInput,
    actor: { uid: string; name: string },
    before?: Subscriber
  ): Promise<void> {
    // API route handles both the subscriber update AND the subscriberAssignments
    // history record via Admin SDK (Firestore rules deny client writes).
    void actor; void before; // passed for future use / type-checking only
    await post("/api/subscribers/assign", input as unknown as Record<string, unknown>);
  },

  /** Unassign all assignment from a subscriber. */
  async unassignSubscriber(
    subscriberId: string,
    subscriberName: string,
    actor: { uid: string; name: string },
    before?: Subscriber,
    reason?: string
  ): Promise<void> {
    await assignmentService.assignSubscriber(
      {
        subscriberId,
        subscriberName,
        assignedSalesId:          null,
        assignedSalesName:        null,
        assignedNutritionistId:   null,
        assignedNutritionistName: null,
        assignedTeamId:           null,
        assignedTeamName:         null,
        assignmentType:           ASSIGNMENT_TYPE.UNASSIGNED,
        reason,
      },
      actor,
      before
    );
  },

  /** Transfer subscriber from one team/employee to another (same as assign but reason is required by convention). */
  async transferSubscriber(
    input: AssignSubscriberInput & { reason: string },
    actor: { uid: string; name: string },
    before?: Subscriber
  ): Promise<void> {
    await assignmentService.assignSubscriber(input, actor, before);
  },

  // ─── History reads ─────────────────────────────────────────────────────────

  /** Fetch assignment history for a subscriber, newest first. */
  async getHistoryBySubscriberId(subscriberId: string): Promise<SubscriberAssignmentRecord[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.SUBSCRIBER_ASSIGNMENTS),
        where("subscriberId", "==", subscriberId),
        orderBy("createdAt", "desc")
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubscriberAssignmentRecord));
  },

  /** Fetch all assignments transferred by a specific employee, newest first. */
  async getHistoryByEmployee(employeeId: string): Promise<SubscriberAssignmentRecord[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.SUBSCRIBER_ASSIGNMENTS),
        where("transferredBy", "==", employeeId),
        orderBy("createdAt", "desc")
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubscriberAssignmentRecord));
  },
};
