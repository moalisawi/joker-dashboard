"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, query, orderBy, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { normalizeSubscriber } from "@/lib/utils";
import type { Subscriber } from "@/types";

function buildQuery(
  user: { uid: string; name?: string; employeeName?: string } | null,
  canViewAll: boolean
) {
  const base = collection(db, "subscribers");
  if (canViewAll) return query(base, orderBy("createdAt", "desc"));
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

  const { data: subscribers = [], isLoading, error } = useQuery<Subscriber[]>({
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

  return {
    subscribers,
    loading: isLoading,
    error:   error instanceof Error ? error.message : null,
  };
}
