"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import type { RenewalWorkflowStatus } from "@/constants/subscriberWorkflow";

/**
 * Records the outcome of a follow-up call from the day's task list.
 *
 * Deliberately reuses /api/subscribers/renewal-status — the route, the schema,
 * the permission check and the audit entry already existed for the renewals tab.
 * The gap was never the backend; it was that the only way to reach it was to
 * open a subscriber, find the tab and change a dropdown, which nobody does
 * thirteen times in a morning.
 */
export function useMarkContact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      subscriberId: string;
      subscriberName: string;
      renewalWorkflowStatus: RenewalWorkflowStatus;
      renewalNote?: string;
    }) => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("انتهت الجلسة — أعد تسجيل الدخول");

      const res = await fetch("/api/subscribers/renewal-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "تعذّر حفظ الحالة");
      return data;
    },

    onSuccess: () => {
      // The task list is derived from the subscribers query, so refreshing that
      // one collection is enough to move the row into its new place.
      qc.invalidateQueries({ queryKey: ["subscribers"] });
    },

    onError: (e: Error) => {
      // Say what failed. A silent failure here is worse than useless: the
      // employee believes the customer is handled and nobody calls them again.
      toast.error(e.message);
    },
  });
}
