"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }       from "@/store/authStore";
import { assignmentService }  from "@/features/subscriberAssignments/services/assignment.service";
import { assignmentKeys }     from "@/features/subscriberAssignments/hooks/queryKeys";
import { subscriberKeys }     from "@/features/subscribers/hooks/queryKeys";
import type { AssignSubscriberInput } from "@/features/subscriberAssignments/schemas";
import type { Subscriber } from "@/types";

/**
 * Mutation hook: assign / transfer / unassign a subscriber.
 * Invalidates both the assignment history and the subscriber cache.
 */
export function useAssignSubscriber(before?: Subscriber) {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (input: AssignSubscriberInput) => {
      if (!user) throw new Error("Not authenticated");
      return assignmentService.assignSubscriber(
        input,
        { uid: user.uid, name: user.name },
        before
      );
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.bySubscriber(input.subscriberId) });
      qc.invalidateQueries({ queryKey: subscriberKeys.detail(input.subscriberId) });
      qc.invalidateQueries({ queryKey: subscriberKeys.lists() });
    },
  });
}

/** Convenience hook pre-wired for unassign. */
export function useUnassignSubscriber(before?: Subscriber) {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ subscriberId, subscriberName, reason }: {
      subscriberId: string; subscriberName: string; reason?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return assignmentService.unassignSubscriber(
        subscriberId, subscriberName,
        { uid: user.uid, name: user.name },
        before,
        reason
      );
    },
    onSuccess: (_data, { subscriberId }) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.bySubscriber(subscriberId) });
      qc.invalidateQueries({ queryKey: subscriberKeys.detail(subscriberId) });
      qc.invalidateQueries({ queryKey: subscriberKeys.lists() });
    },
  });
}
