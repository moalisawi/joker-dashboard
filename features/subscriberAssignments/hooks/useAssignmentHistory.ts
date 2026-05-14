"use client";

import { useQuery } from "@tanstack/react-query";
import { assignmentService } from "@/features/subscriberAssignments/services/assignment.service";
import { assignmentKeys }    from "@/features/subscriberAssignments/hooks/queryKeys";

/** Fetch the immutable assignment history for a subscriber. */
export function useAssignmentHistory(subscriberId: string | undefined) {
  return useQuery({
    queryKey: assignmentKeys.bySubscriber(subscriberId ?? ""),
    queryFn:  () => assignmentService.getHistoryBySubscriberId(subscriberId!),
    enabled:  Boolean(subscriberId),
    staleTime: 30_000,
  });
}

/** Fetch assignment history records created by a specific employee. */
export function useAssignmentHistoryByEmployee(employeeId: string | undefined) {
  return useQuery({
    queryKey: assignmentKeys.byEmployee(employeeId ?? ""),
    queryFn:  () => assignmentService.getHistoryByEmployee(employeeId!),
    enabled:  Boolean(employeeId),
    staleTime: 60_000,
  });
}
