import { z } from "zod";
import { ConversationStatus, LeadStatus } from "@/types/whatsapp-lead";

// ── Shared ───────────────────────────────────────────────────────────────────

const leadIdSchema = z.string().min(1, "leadId مطلوب");

// ── Operation payload schemas ─────────────────────────────────────────────────

export const updateLeadStatusPayloadSchema = z.object({
  operation: z.literal("updateLeadStatus"),
  id:        z.string().min(1),
  status:    z.enum([
    LeadStatus.INTERESTED,
    LeadStatus.READY_TO_PAY,
    LeadStatus.IMPORTANT_FOLLOW_UP,
    LeadStatus.NEW,
    LeadStatus.RETARGETING,
  ]),
});

export const sendMessagePayloadSchema = z.object({
  operation:      z.literal("sendMessage"),
  leadId:         leadIdSchema,
  body:           z.string().min(1, "نص الرسالة مطلوب").max(4000),
  isInternalNote: z.boolean().optional(),
});

export const markAsReadPayloadSchema = z.object({
  operation: z.literal("markAsRead"),
  leadId:    leadIdSchema,
});

export const addNotePayloadSchema = z.object({
  operation: z.literal("addNote"),
  leadId:    leadIdSchema,
  body:      z.string().min(1).max(2000),
});

export const removeNotePayloadSchema = z.object({
  operation: z.literal("removeNote"),
  leadId:    leadIdSchema,
  noteId:    z.string().min(1),
});

export const updateTagsPayloadSchema = z.object({
  operation: z.literal("updateTags"),
  leadId:    leadIdSchema,
  tags:      z
    .array(z.string().min(1).max(30))
    .max(20, "لا يمكن تجاوز 20 تاج"),
});

export const assignLeadPayloadSchema = z.object({
  operation: z.literal("assignLead"),
  leadId:    leadIdSchema,
  uid:       z.string().nullable(),
});

export const updateConversationStatusPayloadSchema = z.object({
  operation: z.literal("updateConversationStatus"),
  leadId:    leadIdSchema,
  status:    z.enum([
    ConversationStatus.OPEN,
    ConversationStatus.CLOSED,
    ConversationStatus.ARCHIVED,
  ]),
});

export const createLeadPayloadSchema = z.object({
  operation:   z.literal("createLead"),
  phone:       z.string().min(7).max(20),
  name:        z.string().max(100).optional(),
  country:     z.string().min(2).max(10),
  countryCode: z.string().min(2).max(6),
});

// ── Union discriminated by operation field ────────────────────────────────────

export const whatsappOperationSchema = z.discriminatedUnion("operation", [
  updateLeadStatusPayloadSchema,
  sendMessagePayloadSchema,
  markAsReadPayloadSchema,
  addNotePayloadSchema,
  removeNotePayloadSchema,
  updateTagsPayloadSchema,
  assignLeadPayloadSchema,
  updateConversationStatusPayloadSchema,
  createLeadPayloadSchema,
]);

export type WhatsappOperationPayload = z.infer<typeof whatsappOperationSchema>;
