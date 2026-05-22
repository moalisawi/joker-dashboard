"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { whatsappLeadsService } from "@/services/whatsapp-leads.service";
import type { LeadFilters, LeadStatus } from "@/types/whatsapp-lead";
import { whatsappLeadKeys } from "./queryKeys";

export function useWhatsappLeadsQuery(
  date: Date,
  extraFilters?: Omit<LeadFilters, "date">,
) {
  const dateKey = date.toISOString().split("T")[0];
  return useQuery({
    queryKey: whatsappLeadKeys.list(dateKey),
    queryFn:  () => whatsappLeadsService.getAll({ date, ...extraFilters }),
    staleTime: 30_000,
  });
}

export function useWhatsappLeadsAnalytics(date: Date) {
  const dateKey = date.toISOString().split("T")[0];
  return useQuery({
    queryKey: whatsappLeadKeys.analytics(dateKey),
    queryFn:  () => whatsappLeadsService.getAnalytics(date),
    staleTime: 30_000,
  });
}

export function useWhatsappLeadsMonthlyAnalytics(referenceDate: Date) {
  const monthKey = `${referenceDate.getFullYear()}-${referenceDate.getMonth() + 1}`;
  return useQuery({
    queryKey: whatsappLeadKeys.monthlyAnalytics(monthKey),
    queryFn:  () => whatsappLeadsService.getMonthlyAnalytics(referenceDate),
    staleTime: 60_000,
  });
}

export function useUpdateLeadStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      whatsappLeadsService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.all() });
      toast.success("تم تحديث الحالة بنجاح");
    },
    onError: () => {
      toast.error("فشل تحديث الحالة");
    },
  });
}
