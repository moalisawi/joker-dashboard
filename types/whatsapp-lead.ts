import type { Timestamp } from "firebase/firestore";
import type { BaseDocument } from "./base";

export const LeadStatus = {
  INTERESTED:          "مهتم",
  READY_TO_PAY:        "جاهز للدفع",
  IMPORTANT_FOLLOW_UP: "متابعة هامة",
  NEW:                 "جديد",
  RETARGETING:         "إعادة استهداف",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export interface WhatsappLead extends BaseDocument {
  phone:              string;
  name?:              string;
  country:            string;
  countryCode:        string;
  status:             LeadStatus;
  firstMessageAt:     Timestamp;
  lastMessageAt:      Timestamp;
  lastMessagePreview: string;
  assignedTo?:        string;
  // conversation extension
  notes?:               LeadNote[];
  tags?:                LeadTag[];
  conversationStatus?:  ConversationStatus;
  unreadCount?:         number;
}

export interface WhatsappMessage {
  id:        string;
  leadId:    string;
  body:      string;
  direction: "inbound" | "outbound";
  timestamp: Timestamp;
  status:    "sent" | "delivered" | "read";
  // conversation extension
  isInternalNote?: boolean;
  attachmentUrl?:  string;
  attachmentType?: "image" | "file";
  deleted?:        boolean;
}

// ── Conversations additions ───────────────────────────────────────────────

export interface LeadNote {
  id:         string;
  leadId:     string;
  body:       string;
  authorUid:  string;
  authorName: string;
  createdAt:  Timestamp;
}

export type LeadTag = string;

export const COMMON_TAGS: LeadTag[] = [
  "متردد",
  "يسأل عن السعر",
  "استفسار صحي",
  "VIP",
  "مكرر",
];

export const ConversationStatus = {
  OPEN:     "مفتوحة",
  CLOSED:   "مغلقة",
  ARCHIVED: "مؤرشفة",
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export interface CannedResponse {
  id:        string;
  title:     string;
  body:      string;
  createdAt: Timestamp;
}

export interface LeadFilters {
  date?:       Date;
  status?:     LeadStatus;
  country?:    string;
  assignedTo?: string;
}

export interface LeadAnalytics {
  total:        number;
  byStatus:     Record<LeadStatus, number>;
  byCountry:    Record<string, number>;
  newToday:     number;
  totalMessages: number;
}

export interface DailyLeadStat {
  date:     string;
  day:      number;
  total:    number;
  byStatus: Partial<Record<LeadStatus, number>>;
}
