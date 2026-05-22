"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { whatsappLeadsService } from "@/services/whatsapp-leads.service";
import type { WhatsappMessage } from "@/types/whatsapp-lead";
import {
  useAddNoteMutation,
  useAssignLeadMutation,
  useCannedResponsesQuery,
  useConversationHistoryQuery,
  useMarkAsReadMutation,
  useMessagesQuery,
  useRemoveNoteMutation,
  useSendMessageMutation,
  useUpdateConversationStatusMutation,
  useUpdateTagsMutation,
  useUpdateLeadStatusMutation,
  whatsappLeadKeys,
} from "@/features/whatsapp-leads";
import {
  type ConversationStatus,
  type LeadStatus,
  type LeadTag,
  type WhatsappLead,
} from "@/types/whatsapp-lead";
import ConversationListPane from "@/components/whatsapp-conversations/ConversationListPane";
import ChatPane from "@/components/whatsapp-conversations/ChatPane";
import InfoSidebarPane from "@/components/whatsapp-conversations/InfoSidebarPane";

// ── Theme tokens (same pattern as analytics/page.tsx) ────────────────────────
const LIGHT = {
  bg:           "var(--page-bg)",
  card:         "#FFFFFF",
  cardBorder:   "rgba(16,20,26,0.05)",
  cardShadow:   "0 1px 2px rgba(16,20,26,.04), 0 12px 28px -12px rgba(16,20,26,.08)",
  headerBg:     "rgba(255,255,255,0.80)",
  divider:      "rgba(16,20,26,0.06)",
  textPri:      "#10141A",
  textSec:      "#6B7280",
  textMut:      "#9CA3AF",
  inboundBubble: "#F0F0F0",
};
const DARK = {
  bg:           "#070c18",
  card:         "rgba(255,255,255,0.035)",
  cardBorder:   "rgba(255,255,255,0.07)",
  cardShadow:   "none",
  headerBg:     "rgba(255,255,255,0.03)",
  divider:      "rgba(255,255,255,0.07)",
  textPri:      "#f1f5f9",
  textSec:      "#6b7280",
  textMut:      "#6B7280",
  inboundBubble: "#2A2F32",
};

// ── All-leads query (no date filter) ─────────────────────────────────────────
function useAllLeadsQuery() {
  return useQuery({
    queryKey: whatsappLeadKeys.lists(),
    queryFn:  () => whatsappLeadsService.getAll(),
    staleTime: 10_000,
  });
}

// ── Main page inner (needs Suspense for useSearchParams) ─────────────────────
function ConversationsPageInner() {
  const router     = useRouter();
  const params     = useSearchParams();
  const leadId     = params.get("leadId");
  const { dark }   = useThemeStore();
  const { user }   = useAuthStore();
  const qc         = useQueryClient();
  const t = dark ? DARK : LIGHT;

  const { data: allLeads = [] } = useAllLeadsQuery();

  const selectedLead = useMemo(
    () => allLeads.find((l: WhatsappLead) => l.id === leadId) ?? null,
    [allLeads, leadId],
  );

  // Auto-select first lead on load
  useEffect(() => {
    if (!leadId && allLeads.length > 0) {
      router.replace(`/whatsapp-leads/conversations?leadId=${allLeads[0].id}`);
    }
  }, [leadId, allLeads, router]);

  // ── Real-time messages listener for the selected conversation ────────────────
  // Only the currently open conversation gets a live Firestore listener.
  // The leads list stays polling via React Query (no onSnapshot there).
  useEffect(() => {
    if (!leadId) return;
    const q = query(
      collection(db, COLLECTIONS.WHATSAPP_MESSAGES),
      where("leadId",  "==", leadId),
      where("deleted", "==", false),
      orderBy("timestamp", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs: WhatsappMessage[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as WhatsappMessage));
      qc.setQueryData(whatsappLeadKeys.messages(leadId), msgs);
    });
    return () => unsub();
  }, [leadId, qc]);

  // Mark as read when conversation opens
  const markRead = useMarkAsReadMutation();
  useEffect(() => {
    if (selectedLead && (selectedLead.unreadCount ?? 0) > 0) {
      markRead.mutate(selectedLead.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

  // Messages
  const { data: messages = [], isLoading: msgsLoading } = useMessagesQuery(leadId);

  // Canned responses
  const { data: cannedResponses = [] } = useCannedResponsesQuery();

  // Conversation history for selected lead's phone
  const { data: history = [], isLoading: historyLoading } = useConversationHistoryQuery(
    selectedLead?.phone ?? null,
  );

  // Mutations
  const sendMsg      = useSendMessageMutation();
  const addNote      = useAddNoteMutation();
  const removeNote   = useRemoveNoteMutation();
  const updateTags   = useUpdateTagsMutation();
  const assignLead   = useAssignLeadMutation();
  const updateConvSt = useUpdateConversationStatusMutation();
  const updateStatus = useUpdateLeadStatusMutation();

  function selectLead(lead: WhatsappLead) {
    router.push(`/whatsapp-leads/conversations?leadId=${lead.id}`);
  }

  function handleSend(body: string, isInternalNote: boolean) {
    if (!leadId) return;
    sendMsg.mutate({ leadId, body, isInternalNote });
  }

  function handleConvStatusChange(status: ConversationStatus) {
    if (!leadId) return;
    updateConvSt.mutate({ leadId, status });
  }

  function handleLeadStatusChange(status: LeadStatus) {
    if (!leadId) return;
    updateStatus.mutate({ id: leadId, status });
  }

  function handleAssign(uid: string | null) {
    if (!leadId) return;
    assignLead.mutate({ leadId, uid });
  }

  function handleAddNote(body: string) {
    if (!leadId || !user) return;
    addNote.mutate({ leadId, body, author: { uid: user.uid, name: user.name } });
  }

  function handleRemoveNote(noteId: string) {
    if (!leadId) return;
    removeNote.mutate({ leadId, noteId });
  }

  function handleAddTag(tag: LeadTag) {
    if (!selectedLead) return;
    const current = selectedLead.tags ?? [];
    if (current.includes(tag)) return;
    updateTags.mutate({ leadId: selectedLead.id, tags: [...current, tag] });
  }

  function handleRemoveTag(tag: LeadTag) {
    if (!selectedLead) return;
    updateTags.mutate({ leadId: selectedLead.id, tags: (selectedLead.tags ?? []).filter((t) => t !== tag) });
  }

  // Always use the freshest version of the lead from the query cache
  const freshLead = useMemo(
    () => allLeads.find((l: WhatsappLead) => l.id === leadId) ?? null,
    [allLeads, leadId],
  );

  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
        background: t.bg,
        fontFamily: "inherit",
      }}
    >
      {/* Pane 1: Conversation list (RTL = visually on the right) */}
      <ConversationListPane
        leads={allLeads}
        selectedId={leadId}
        onSelect={selectLead}
        t={t}
      />

      {/* Pane 2: Chat view (center, widest) */}
      <ChatPane
        lead={freshLead}
        messages={messages}
        loading={msgsLoading}
        sending={sendMsg.isPending}
        cannedResponses={cannedResponses}
        onSend={handleSend}
        onStatusChange={handleConvStatusChange}
        t={t}
      />

      {/* Pane 3: Info sidebar (RTL = visually on the left) */}
      <InfoSidebarPane
        lead={freshLead}
        history={history}
        historyLoading={historyLoading}
        onStatusChange={handleLeadStatusChange}
        onAssign={handleAssign}
        onAddNote={handleAddNote}
        onRemoveNote={handleRemoveNote}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        t={t}
      />
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#6B7280",
            fontSize: 14,
          }}
        >
          جاري التحميل...
        </div>
      }
    >
      <ConversationsPageInner />
    </Suspense>
  );
}
