"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, query, orderBy, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { normalizeSubscriber } from "@/lib/utils";
import { deletedSubscriberIds } from "@/lib/subscriberLifecycle";
import type { Subscriber } from "@/types";

function buildQuery(
  user: { uid: string; name?: string; employeeName?: string } | null,
  canViewAll: boolean
) {
  const base = collection(db, "subscribers");
  if (canViewAll) return query(base, orderBy("createdAt", "desc"));
  // Prefer UID-based query (survives name changes); fall back to name for legacy records.
  // Firestore security rules enforce the same two-tier check server-side, so both queries
  // are safe — the rules will reject any document the employee is not allowed to see.
  if (user?.uid) return query(base, where("convincedByUid", "==", user.uid));
  return query(
    base,
    where("convincedBy", "==", user?.employeeName || user?.name || "")
  );
}

export function useSubscribers() {
  const { user, can } = useAuthStore();
  const qc           = useQueryClient();
  const canViewAll   = can("canViewAll");
  const queryKey     = ["subscribers", user?.uid, canViewAll] as const;

  /*
   * The cache holds EVERY subscriber, archived ones included, and the split
   * happens below. Filtering inside the query would throw the archived ids away
   * before anything could use them — and the payments, invoices and instalments
   * of an archived subscriber have to be filtered against exactly that set.
   */
  const { data: allSubscribers = [], isLoading, error } = useQuery<Subscriber[]>({
    queryKey,
    queryFn: async () => {
      const snap = await getDocs(buildQuery(user, canViewAll));
      return snap.docs
        .map((d) => normalizeSubscriber({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },
    staleTime: Infinity,
    enabled:   !!user,
  });

  // Real-time updates push directly into React Query cache
  useEffect(() => {
    if (!user) return;
    const q = buildQuery(user, canViewAll);
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => normalizeSubscriber({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      qc.setQueryData<Subscriber[]>(queryKey, data);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, canViewAll]);

  /*
   * The archived ids, exposed alongside the visible list.
   *
   * Callers need them to filter the OTHER collections. `subscribers` here is
   * already stripped of deleted rows, so a caller holding only this list cannot
   * tell whether a payment belongs to an archived subscriber or to one outside
   * their own permission scope — and treating those the same would silently
   * drop real money from the totals. Returning the ids keeps that distinction
   * available.
   */
  const deletedIds  = deletedSubscriberIds(allSubscribers as { id: string; deleted?: boolean }[]);
  const subscribers = allSubscribers.filter((s) => s.deleted !== true);

  return {
    subscribers,
    deletedIds,
    loading: isLoading,
    error:   error instanceof Error ? error.message : null,
  };
}
