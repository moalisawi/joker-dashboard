"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }          from "@/store/authStore";
import { subscriberNotesService } from "@/services/subscriberNotes.service";
import { noteKeys }              from "@/features/subscriberNotes/hooks/queryKeys";
import type { SubscriberNote }   from "@/types";

/**
 * Real-time subscriber notes query.
 * Seeds React Query cache from an initial fetch then keeps it live via
 * an onSnapshot listener (same pattern as useSubscribersQuery).
 */
export function useSubscriberNotes(subscriberId: string | undefined) {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const queryKey = noteKeys.bySubscriber(subscriberId ?? "");

  const result = useQuery<SubscriberNote[]>({
    queryKey,
    queryFn:  () => subscriberNotesService.getBySubscriberId(subscriberId!),
    enabled:  Boolean(subscriberId && user),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!subscriberId || !user) return;
    const unsub = subscriberNotesService.listenBySubscriberId(subscriberId, (notes) => {
      qc.setQueryData<SubscriberNote[]>(queryKey, notes);
    });
    return () => unsub();
  }, [subscriberId, user?.uid]);

  return result;
}
