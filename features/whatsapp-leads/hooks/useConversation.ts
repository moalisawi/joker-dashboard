"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { whatsappLeadsService } from "@/services/whatsapp-leads.service";
import type {
  ConversationStatus,
  LeadTag,
  WhatsappMessage,
} from "@/types/whatsapp-lead";
import { whatsappLeadKeys } from "./queryKeys";

export function useMessagesQuery(leadId: string | null) {
  return useQuery({
    queryKey: whatsappLeadKeys.messages(leadId ?? ""),
    queryFn:  () => whatsappLeadsService.getMessagesByLeadId(leadId!),
    enabled:  !!leadId,
    staleTime: 10_000,
  });
}

export function useSendMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      body,
      isInternalNote,
    }: {
      leadId: string;
      body: string;
      isInternalNote?: boolean;
    }) => whatsappLeadsService.sendMessage(leadId, body, isInternalNote),

    onMutate: async ({ leadId, body, isInternalNote }) => {
      await qc.cancelQueries({ queryKey: whatsappLeadKeys.messages(leadId) });
      const prev = qc.getQueryData<WhatsappMessage[]>(whatsappLeadKeys.messages(leadId));
      const optimistic: WhatsappMessage = {
        id:        `optimistic_${Date.now()}`,
        leadId,
        body,
        direction: "outbound",
        timestamp: { toDate: () => new Date(), toMillis: () => Date.now() } as never,
        status:    "sent",
        ...(isInternalNote ? { isInternalNote: true } : {}),
      };
      qc.setQueryData<WhatsappMessage[]>(
        whatsappLeadKeys.messages(leadId),
        (old) => [...(old ?? []), optimistic],
      );
      return { prev, leadId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(whatsappLeadKeys.messages(ctx.leadId), ctx.prev);
      }
      toast.error("فشل إرسال الرسالة");
    },

    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.messages(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
    },
  });
}

export function useMarkAsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => whatsappLeadsService.markAsRead(leadId),
    onSuccess: (_data, leadId) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.detail(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
    },
  });
}

export function useAddNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      body,
      author,
    }: {
      leadId: string;
      body: string;
      author: { uid: string; name: string };
    }) => whatsappLeadsService.addNote(leadId, body, author),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.detail(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
      toast.success("تمت إضافة الملاحظة");
    },
    onError: () => {
      toast.error("فشل إضافة الملاحظة");
    },
  });
}

export function useRemoveNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, noteId }: { leadId: string; noteId: string }) =>
      whatsappLeadsService.removeNote(leadId, noteId),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.detail(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
      toast.success("تم حذف الملاحظة");
    },
    onError: () => {
      toast.error("فشل حذف الملاحظة");
    },
  });
}

export function useUpdateTagsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, tags }: { leadId: string; tags: LeadTag[] }) =>
      whatsappLeadsService.updateTags(leadId, tags),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.detail(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
      toast.success("تم تحديث التاجز");
    },
    onError: () => {
      toast.error("فشل تحديث التاجز");
    },
  });
}

export function useAssignLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, uid }: { leadId: string; uid: string | null }) =>
      whatsappLeadsService.assignLead(leadId, uid),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.detail(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
      toast.success("تم تحديث التعيين");
    },
    onError: () => {
      toast.error("فشل تحديث التعيين");
    },
  });
}

export function useUpdateConversationStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      status,
    }: {
      leadId: string;
      status: ConversationStatus;
    }) => whatsappLeadsService.updateConversationStatus(leadId, status),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.detail(leadId) });
      qc.invalidateQueries({ queryKey: whatsappLeadKeys.lists() });
      toast.success("تم تحديث حالة المحادثة");
    },
    onError: () => {
      toast.error("فشل تحديث الحالة");
    },
  });
}

export function useCannedResponsesQuery() {
  return useQuery({
    queryKey: whatsappLeadKeys.cannedResponses(),
    queryFn:  () => whatsappLeadsService.getCannedResponses(),
    staleTime: 5 * 60_000,
  });
}

export function useConversationHistoryQuery(phone: string | null) {
  return useQuery({
    queryKey: whatsappLeadKeys.history(phone ?? ""),
    queryFn:  () => whatsappLeadsService.getConversationHistory(phone!),
    enabled:  !!phone,
    staleTime: 30_000,
  });
}
