"use client";

import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { subscriberService } from "@/services/subscribers.service";
import { normalizeSubscriber } from "@/lib/utils";
import { COLLECTIONS } from "@/constants";
import { subscriberKeys } from "./queryKeys";
import type { Subscriber } from "@/types";
import type { CreateSubscriberInput, UpdateSubscriberInput } from "../schemas/subscriber.schema";
import { callSubscriberOperation } from "@/lib/clientOperations";

// ─── List query with real-time sync ──────────────────────────────────────────

/**
 * Primary subscribers query.
 *
 * Strategy:
 * - useQuery handles loading/error states and caches the result.
 * - A Firestore onSnapshot listener keeps the cache live without polling.
 * - refetchOnWindowFocus is disabled globally (queryClient.ts) because
 *   the real-time listener already ensures freshness.
 */
export function useSubscribersQuery() {
  const queryClient = useQueryClient();
  const { user, can } = useAuthStore();

  const queryKey = subscriberKeys.list(user?.uid);

  // Seed cache from one-shot fetch (prevents empty flash on first mount)
  const result = useQuery({
    queryKey,
    queryFn: () => subscriberService.getAll(),
    enabled:   !!user,
    staleTime: Infinity, // real-time listener owns freshness
  });

  // Real-time listener → writes directly into React Query cache
  useEffect(() => {
    if (!user) return;

    const base = collection(db, COLLECTIONS.SUBSCRIBERS);
    const q = can("canViewAll")
      ? query(base, orderBy("createdAt", "desc"))
      : query(base, where("convincedBy", "==", user.employeeName || user.name || ""));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => normalizeSubscriber({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        queryClient.setQueryData<Subscriber[]>(queryKey, data);
      },
      (err) => console.warn("[useSubscribersQuery] snapshot error:", err)
    );

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, can]);

  return result;
}

// ─── Single subscriber detail ─────────────────────────────────────────────────

export function useSubscriberQuery(id: string | undefined) {
  return useQuery({
    queryKey: subscriberKeys.detail(id ?? ""),
    queryFn:  () => subscriberService.getById(id!),
    enabled:  !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateSubscriberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSubscriberInput) =>
      callSubscriberOperation("createSubscriber", { subscriber: data }),
    onSuccess: () => {
      // Real-time listener will refresh the list; this is a safety net.
      queryClient.invalidateQueries({ queryKey: subscriberKeys.lists() });
    },
  });
}

export function useUpdateSubscriberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateSubscriberInput) =>
      subscriberService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: subscriberKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: subscriberKeys.lists() });
    },
  });
}

export function useDeleteSubscriberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => subscriberService.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: subscriberKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: subscriberKeys.lists() });
    },
  });
}
