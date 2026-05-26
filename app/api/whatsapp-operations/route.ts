import { NextResponse } from "next/server";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { whatsappOperationSchema } from "@/features/whatsapp-leads/schemas/operations.schema";
import { ConversationStatus, LeadStatus } from "@/types/whatsapp-lead";

export const runtime = "nodejs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

type ServerUser = Awaited<ReturnType<typeof verifyServerUser>>;

function actorName(user: NonNullable<ServerUser>): string {
  return user.email ?? user.uid;
}

// Server-side audit writer using Admin SDK (mirrors subscriber-operations pattern)
async function writeAudit(
  user: NonNullable<ServerUser>,
  action: string,
  details: {
    category?: string;
    severity?: string;
    entityType?: string;
    entityId?: string;
    entityName?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const db = getFirestore();
  const performer = { uid: user.uid, name: actorName(user), email: user.email ?? "", role: user.role };
  await db.collection("auditLogs").add({
    action,
    category:     details.category  ?? "whatsapp",
    severity:     details.severity  ?? "info",
    source:       "server",
    entityType:   details.entityType  ?? null,
    entityId:     details.entityId    ?? null,
    entityName:   details.entityName  ?? null,
    description:  details.description ?? null,
    previousData: null,
    newData:      null,
    changedFields: [],
    performedBy:  performer,
    financialData: null,
    metadata:     details.metadata ?? {},
    tags:         ["server-operation", "whatsapp"],
    status:       "completed",
    actorUid:     performer.uid,
    actorName:    performer.name,
    actorRole:    performer.role,
    targetType:   details.entityType ?? null,
    targetId:     details.entityId   ?? null,
    targetName:   details.entityName ?? null,
    summary:      details.description ?? null,
    createdAt:    FieldValue.serverTimestamp(),
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit: 60 whatsapp operations per IP per minute
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`whatsapp-ops:${ip}`, 60, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  // Auth check
  let user: ServerUser;
  try {
    user = await verifyServerUser(request);
  } catch (err) {
    console.error("[whatsapp-operations] auth failed:", err);
    return jsonError("Unauthorized", 401);
  }
  if (!user) return jsonError("Unauthorized", 401);

  // whatsappLeads/whatsappMessages writes via Admin SDK only.
  if (!hasAdminCredentials()) {
    return jsonError("Admin credentials غير مفعّلة على السيرفر", 503);
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // Validate with Zod discriminated union
  const parsed = whatsappOperationSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return jsonError(`Validation error: ${msg}`, 400);
  }

  const payload = parsed.data;

  try {
    switch (payload.operation) {
      case "updateLeadStatus":
        return NextResponse.json(await updateLeadStatus(user, payload.id, payload.status));
      case "sendMessage":
        return NextResponse.json(
          await sendMessage(user, payload.leadId, payload.body, payload.isInternalNote ?? false)
        );
      case "markAsRead":
        return NextResponse.json(await markAsRead(user, payload.leadId));
      case "addNote":
        return NextResponse.json(await addNote(user, payload.leadId, payload.body));
      case "removeNote":
        return NextResponse.json(await removeNote(user, payload.leadId, payload.noteId));
      case "updateTags":
        return NextResponse.json(await updateTags(user, payload.leadId, payload.tags));
      case "assignLead":
        return NextResponse.json(await assignLead(user, payload.leadId, payload.uid));
      case "updateConversationStatus":
        return NextResponse.json(await updateConversationStatus(user, payload.leadId, payload.status));
      case "createLead":
        return NextResponse.json(
          await createLead(user, payload.phone, payload.name, payload.country, payload.countryCode)
        );
      default:
        return jsonError("Unknown operation", 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp-operations] operation failed:", message);
    return jsonError(message, 500);
  }
}

// ── Operations ────────────────────────────────────────────────────────────────

async function updateLeadStatus(
  user: NonNullable<ServerUser>,
  id: string,
  status: LeadStatus
) {
  const db  = getFirestore();
  const ref = db.collection("whatsappLeads").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");

  await ref.update({
    status,
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit(user, "whatsapp_lead_status_changed", {
    entityType: "whatsappLead",
    entityId:   id,
    entityName: asString(snap.data()?.name, snap.data()?.phone),
    description: `Status changed to: ${status}`,
    metadata:   { status },
  });

  return { success: true };
}

async function sendMessage(
  user: NonNullable<ServerUser>,
  leadId: string,
  body: string,
  isInternalNote: boolean
) {
  const db      = getFirestore();
  const leadRef = db.collection("whatsappLeads").doc(leadId);
  const snap    = await leadRef.get();
  if (!snap.exists) throw new Error("Lead not found");

  // Create message document
  const msgRef = db.collection("whatsappMessages").doc();
  const now    = FieldValue.serverTimestamp();

  await msgRef.set({
    leadId,
    body,
    direction:      "outbound",
    timestamp:      now,
    status:         "sent",
    isInternalNote: isInternalNote || false,
    deleted:        false,
    createdBy:      user.uid,
    createdAt:      now,
  });

  // Update lead's last message preview (truncate to 100 chars) and timestamp
  const preview = body.length > 100 ? body.slice(0, 100) + "…" : body;
  await leadRef.update({
    lastMessageAt:      now,
    lastMessagePreview: preview,
    updatedAt:          now,
    updatedBy:          user.uid,
  });

  // Only audit internal notes (messaging is too noisy to audit every message)
  if (isInternalNote) {
    await writeAudit(user, "whatsapp_internal_note_added", {
      entityType:  "whatsappLead",
      entityId:    leadId,
      entityName:  asString(snap.data()?.name, snap.data()?.phone),
      description: "داخلي: تمت إضافة ملاحظة داخلية عبر الرسائل",
      metadata:    { messageId: msgRef.id },
    });
  }

  return {
    success: true,
    message: {
      id:             msgRef.id,
      leadId,
      body,
      direction:      "outbound",
      status:         "sent",
      isInternalNote: isInternalNote || false,
      deleted:        false,
      createdBy:      user.uid,
    },
  };
}

async function markAsRead(user: NonNullable<ServerUser>, leadId: string) {
  const db  = getFirestore();
  const ref = db.collection("whatsappLeads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");

  await ref.update({
    unreadCount: 0,
    updatedAt:   FieldValue.serverTimestamp(),
    updatedBy:   user.uid,
  });

  return { success: true };
}

async function addNote(user: NonNullable<ServerUser>, leadId: string, body: string) {
  const db  = getFirestore();
  const ref = db.collection("whatsappLeads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");

  const data    = snap.data() ?? {};
  const existing = Array.isArray(data.notes) ? data.notes : [];

  // NOTE: serverTimestamp() cannot be used inside array fields in Firestore.
  // Timestamp.now() is used here as a safe alternative for embedded note objects.
  const note = {
    id:         crypto.randomUUID(),
    leadId,
    body,
    authorUid:  user.uid,
    authorName: actorName(user),
    createdAt:  Timestamp.now(),
  };

  await ref.update({
    notes:     [...existing, note],
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "whatsapp_note_added", {
    entityType:  "whatsappLead",
    entityId:    leadId,
    entityName:  asString(data.name, data.phone),
    description: "تمت إضافة ملاحظة داخلية",
    metadata:    { noteId: note.id },
  });

  return { success: true, note };
}

async function removeNote(user: NonNullable<ServerUser>, leadId: string, noteId: string) {
  const db  = getFirestore();
  const ref = db.collection("whatsappLeads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");

  const data    = snap.data() ?? {};
  const existing = Array.isArray(data.notes) ? data.notes : [];
  const before   = existing.find((n: { id: string }) => n.id === noteId);
  const updated  = existing.filter((n: { id: string }) => n.id !== noteId);

  await ref.update({
    notes:     updated,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "whatsapp_note_removed", {
    severity:    "warning",
    entityType:  "whatsappLead",
    entityId:    leadId,
    entityName:  asString(data.name, data.phone),
    description: "تم حذف ملاحظة داخلية",
    metadata:    { noteId, before },
  });

  return { success: true };
}

async function updateTags(
  user: NonNullable<ServerUser>,
  leadId: string,
  tags: string[]
) {
  const db  = getFirestore();
  const ref = db.collection("whatsappLeads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");

  const data = snap.data() ?? {};
  await ref.update({
    tags,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "whatsapp_tags_updated", {
    entityType:  "whatsappLead",
    entityId:    leadId,
    entityName:  asString(data.name, data.phone),
    description: `Tags updated: ${tags.join(", ")}`,
    metadata:    { tags, previousTags: data.tags ?? [] },
  });

  return { success: true };
}

async function assignLead(
  user: NonNullable<ServerUser>,
  leadId: string,
  uid: string | null
) {
  const db      = getFirestore();
  const leadRef = db.collection("whatsappLeads").doc(leadId);
  const snap    = await leadRef.get();
  if (!snap.exists) throw new Error("Lead not found");

  // If assigning a user, verify the user exists
  if (uid !== null) {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new Error("User not found");
  }

  const data = snap.data() ?? {};
  await leadRef.update({
    assignedTo: uid ?? FieldValue.delete(),
    updatedAt:  FieldValue.serverTimestamp(),
    updatedBy:  user.uid,
  });

  await writeAudit(user, "whatsapp_lead_assigned", {
    entityType:  "whatsappLead",
    entityId:    leadId,
    entityName:  asString(data.name, data.phone),
    description: uid ? `Assigned to: ${uid}` : "Unassigned",
    metadata:    { assignedTo: uid, previousAssignedTo: data.assignedTo ?? null },
  });

  return { success: true };
}

async function updateConversationStatus(
  user: NonNullable<ServerUser>,
  leadId: string,
  status: ConversationStatus
) {
  const db  = getFirestore();
  const ref = db.collection("whatsappLeads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");

  const data = snap.data() ?? {};
  await ref.update({
    conversationStatus: status,
    updatedAt:          FieldValue.serverTimestamp(),
    updatedBy:          user.uid,
  });

  await writeAudit(user, "whatsapp_conversation_status_changed", {
    entityType:  "whatsappLead",
    entityId:    leadId,
    entityName:  asString(data.name, data.phone),
    description: `Conversation status: ${status}`,
    metadata:    { status, previousStatus: data.conversationStatus ?? null },
  });

  return { success: true };
}

async function createLead(
  user: NonNullable<ServerUser>,
  phone: string,
  name: string | undefined,
  country: string,
  countryCode: string
) {
  const db = getFirestore();

  // Check for existing non-deleted lead with same phone
  const existing = await db
    .collection("whatsappLeads")
    .where("phone", "==", phone)
    .where("deleted", "==", false)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    return { success: true, leadId: doc.id, existing: true };
  }

  const now  = FieldValue.serverTimestamp();
  const ref  = db.collection("whatsappLeads").doc();

  await ref.set({
    phone,
    ...(name ? { name } : {}),
    country,
    countryCode,
    status:             LeadStatus.NEW,
    conversationStatus: ConversationStatus.OPEN,
    firstMessageAt:     now,
    lastMessageAt:      now,
    lastMessagePreview: "",
    unreadCount:        0,
    notes:              [],
    tags:               [],
    deleted:            false,
    createdBy:          user.uid,
    createdAt:          now,
    updatedBy:          user.uid,
    updatedAt:          now,
  });

  await writeAudit(user, "whatsapp_lead_created", {
    entityType:  "whatsappLead",
    entityId:    ref.id,
    entityName:  name ?? phone,
    description: `New lead created: ${name ?? phone}`,
    metadata:    { phone, country },
  });

  return { success: true, leadId: ref.id, existing: false };
}
