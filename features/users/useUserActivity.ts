"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import type { LoginSession, AuditLog } from "@/types";

/**
 * A single user's sessions and audit trail, for the profile page.
 *
 * Both queries are `where(...)` with a `limit` and no `orderBy`, sorted in
 * JavaScript afterwards. Adding `orderBy` on a different field would need a new
 * composite index, and a query whose index has not been deployed fails at
 * runtime with permission-denied — an empty tab that looks like "this person has
 * never logged in". Fifty rows is well inside what a client can sort, and the
 * page shows the most recent handful anyway.
 *
 * firestore.rules restricts `loginSessions` to staff and `auditLogs` to staff or
 * holders of logs.view, which is the same bar the profile page requires.
 */

const FETCH_LIMIT = 50;

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  const parsed = new Date(value as string).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function useUserSessions(uid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["users", uid, "sessions"],
    enabled: Boolean(uid) && enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<LoginSession[]> => {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.LOGIN_SESSIONS), where("uid", "==", uid), limit(FETCH_LIMIT))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as LoginSession))
        .sort((a, b) => toMillis(b.loginAt) - toMillis(a.loginAt));
    },
  });
}

/**
 * Entries where this user is the *subject*, not the actor: who disabled them,
 * who changed their permissions, what was transferred off their account. That is
 * the question a profile page answers. What the person themselves did belongs on
 * the global log page, which already filters by actor.
 */
export function useUserAuditTrail(uid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["users", uid, "audit"],
    enabled: Boolean(uid) && enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<AuditLog[]> => {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.AUDIT_LOGS), where("targetId", "==", uid), limit(FETCH_LIMIT))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as unknown as AuditLog))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },
  });
}
