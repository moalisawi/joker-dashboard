import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { auth } from "@/lib/auth";
import { COLLECTIONS } from "@/constants/collections";
import { excludeDeleted } from "@/lib/softDelete";
import {
  
  LeadStatus,
  type CannedResponse,
  type ConversationStatus as ConvStatus,
  type DailyLeadStat,
  type LeadAnalytics,
  type LeadFilters,
  type LeadNote,
  type LeadTag,
  type WhatsappLead,
  type WhatsappMessage} from "@/types/whatsapp-lead";

// ── Auth token helper ─────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized — please log in");
  return token;
}

// ── API route caller (mirrors callSubscriberOperation pattern) ────────────────

async function callWhatsappOperation<T = Record<string, unknown>>(
  payload: Record<string, unknown>
): Promise<T & { success: boolean }> {
  const token = await getToken();
  const res   = await fetch("/api/whatsapp-operations", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as T & { success: boolean; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Operation failed");
  }
  return data;
}

// ── Day helpers for date-range queries ───────────────────────────────────────

function dayStart(date: Date): Timestamp {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function dayEnd(date: Date): Timestamp {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeLead(id: string, data: Record<string, unknown>): WhatsappLead {
  return { id, ...data } as unknown as WhatsappLead;
}

function normalizeMessage(id: string, data: Record<string, unknown>): WhatsappMessage {
  return { id, ...data } as unknown as WhatsappMessage;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const whatsappLeadsService = {
  // ── Read methods (client-side Firestore) ────────────────────────────────────

  async getAll(filters?: LeadFilters): Promise<WhatsappLead[]> {
    const col = collection(db, COLLECTIONS.WHATSAPP_LEADS);

    if (filters?.date) {
      // Date range uses equality on deleted to allow range on lastMessageAt.
      // Firestore disallows combining != (inequality) with range on a different field.
      const start = dayStart(filters.date);
      const end   = dayEnd(filters.date);
      let q = query(
        col,
        where("deleted", "==", false),
        where("lastMessageAt", ">=", start),
        where("lastMessageAt", "<=", end),
        orderBy("lastMessageAt", "desc"),
      );
      if (filters.status)     q = query(q, where("status", "==", filters.status));
      if (filters.country)    q = query(q, where("country", "==", filters.country));
      if (filters.assignedTo) q = query(q, where("assignedTo", "==", filters.assignedTo));
      const snap = await getDocs(q);
      return snap.docs.map((d) => normalizeLead(d.id, d.data()));
    }

    // No date filter — use excludeDeleted() with orderBy on lastMessageAt
    let q = excludeDeleted(col);
    if (filters?.status)     q = query(q, where("status", "==", filters.status));
    if (filters?.country)    q = query(q, where("country", "==", filters.country));
    if (filters?.assignedTo) q = query(q, where("assignedTo", "==", filters.assignedTo));
    q = query(q, orderBy("lastMessageAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeLead(d.id, d.data()));
  },

  async getByDate(date: Date): Promise<WhatsappLead[]> {
    return whatsappLeadsService.getAll({ date });
  },

  async getById(id: string): Promise<WhatsappLead | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.WHATSAPP_LEADS, id));
    if (!snap.exists() || snap.data()?.deleted === true) return null;
    return normalizeLead(snap.id, snap.data()!);
  },

  async getMessagesByLeadId(leadId: string): Promise<WhatsappMessage[]> {
    const q = query(
      collection(db, COLLECTIONS.WHATSAPP_MESSAGES),
      where("leadId",  "==", leadId),
      where("deleted", "==", false),
      orderBy("timestamp", "asc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeMessage(d.id, d.data()));
  },

  async getConversationHistory(phone: string): Promise<WhatsappLead[]> {
    const q = query(
      collection(db, COLLECTIONS.WHATSAPP_LEADS),
      where("phone",   "==", phone),
      where("deleted", "==", false),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeLead(d.id, d.data()));
  },

  async getCannedResponses(): Promise<CannedResponse[]> {
    const q = query(
      collection(db, COLLECTIONS.CANNED_RESPONSES),
      where("deleted", "==", false),
      orderBy("createdAt", "asc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CannedResponse);
  },

  async getAnalytics(date: Date): Promise<LeadAnalytics> {
    const dayLeads = await whatsappLeadsService.getByDate(date);

    const byStatus: Record<LeadStatus, number> = {
      [LeadStatus.INTERESTED]:          0,
      [LeadStatus.READY_TO_PAY]:        0,
      [LeadStatus.IMPORTANT_FOLLOW_UP]: 0,
      [LeadStatus.NEW]:                 0,
      [LeadStatus.RETARGETING]:         0,
    };
    const byCountry: Record<string, number> = {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let newToday = 0;

    for (const lead of dayLeads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
      byCountry[lead.country] = (byCountry[lead.country] ?? 0) + 1;
      if (lead.firstMessageAt.toDate() >= todayStart) newToday++;
    }

    return {
      total:         dayLeads.length,
      byStatus,
      byCountry,
      newToday,
      totalMessages: dayLeads.length,
    };
  },

  async getMonthlyAnalytics(referenceDate: Date): Promise<DailyLeadStat[]> {
    const year  = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const today = new Date();

    // Fetch all leads in the month with a range query
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
    const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTIONS.WHATSAPP_LEADS),
      where("deleted", "==", false),
      where("lastMessageAt", ">=", Timestamp.fromDate(monthStart)),
      where("lastMessageAt", "<=", Timestamp.fromDate(monthEnd)),
    );
    const snap  = await getDocs(q);
    const leads = snap.docs.map((d) => normalizeLead(d.id, d.data()));

    // Build day-keyed buckets
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const stats: DailyLeadStat[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d > today) break;

      const dateStr   = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayLeads  = leads.filter((l) => isSameDay(l.lastMessageAt.toDate(), d));
      const byStatus: Partial<Record<LeadStatus, number>> = {};
      for (const lead of dayLeads) {
        byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
      }

      stats.push({ date: dateStr, day, total: dayLeads.length, byStatus });
    }

    return stats;
  },

  // ── Write methods (through /api/whatsapp-operations) ─────────────────────────

  async updateStatus(id: string, status: LeadStatus): Promise<void> {
    await callWhatsappOperation({ operation: "updateLeadStatus", id, status });
  },

  async sendMessage(
    leadId: string,
    body: string,
    isInternalNote = false,
  ): Promise<WhatsappMessage> {
    const res = await callWhatsappOperation<{ message: Record<string, unknown> }>({
      operation: "sendMessage",
      leadId,
      body,
      isInternalNote,
    });
    // Attach a client-side Timestamp so the returned object conforms to WhatsappMessage
    return {
      ...(res.message as Omit<WhatsappMessage, "timestamp">),
      timestamp: Timestamp.fromDate(new Date()),
    } as WhatsappMessage;
  },

  async markAsRead(leadId: string): Promise<void> {
    await callWhatsappOperation({ operation: "markAsRead", leadId });
  },

  async addNote(
    leadId: string,
    body: string,
    author: { uid: string; name: string },
  ): Promise<LeadNote> {
    const res = await callWhatsappOperation<{ note: Record<string, unknown> }>({
      operation: "addNote",
      leadId,
      body,
    });
    return res.note as unknown as LeadNote;
  },

  async removeNote(leadId: string, noteId: string): Promise<void> {
    await callWhatsappOperation({ operation: "removeNote", leadId, noteId });
  },

  async updateTags(leadId: string, tags: LeadTag[]): Promise<void> {
    await callWhatsappOperation({ operation: "updateTags", leadId, tags });
  },

  async assignLead(leadId: string, uid: string | null): Promise<void> {
    await callWhatsappOperation({ operation: "assignLead", leadId, uid });
  },

  async updateConversationStatus(leadId: string, status: ConvStatus): Promise<void> {
    await callWhatsappOperation({ operation: "updateConversationStatus", leadId, status });
  },
};
