import { NextResponse }  from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsGet, fsPatch, fsAdd }           from "@/lib/serverFirestore";
import { z } from "zod";
import { ASSIGNMENT_TYPE } from "@/constants/subscriberWorkflow";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

const bodySchema = z.object({
  subscriberId:              z.string().min(1),
  subscriberName:            z.string().default(""),
  assignedSalesId:           z.string().nullable().optional(),
  assignedSalesName:         z.string().nullable().optional(),
  assignedNutritionistId:    z.string().nullable().optional(),
  assignedNutritionistName:  z.string().nullable().optional(),
  assignedTeamId:            z.string().nullable().optional(),
  assignedTeamName:          z.string().nullable().optional(),
  assignmentType:            z.enum(["sales","nutrition","owner","unassigned"]),
  reason:                    z.string().max(300).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);

  const canAssign   = hasServerPermission(actor, "subscribers", "assign")
                   || hasServerPermission(actor, "subscribers", "edit");
  const canTransfer = hasServerPermission(actor, "subscribers", "transfer")
                   || actor.role === "owner"
                   || actor.role === "admin";
  if (!canAssign && !canTransfer) return jsonError("Forbidden", 403);

  const token = getBearerToken(request)!;

  // ── Validate ──────────────────────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const {
    subscriberId, subscriberName,
    assignedSalesId, assignedSalesName,
    assignedNutritionistId, assignedNutritionistName,
    assignedTeamId, assignedTeamName,
    assignmentType, reason,
  } = parsed.data;

  // ── Fetch current subscriber (for before-state + history) ────────────────────
  let before: Record<string, unknown> | null = null;
  if (hasAdminCredentials()) {
    const snap = await getFirestore().collection("subscribers").doc(subscriberId).get();
    if (!snap.exists) return jsonError("Subscriber not found", 404);
    before = snap.data() as Record<string, unknown>;
  } else {
    before = await fsGet("subscribers", subscriberId, token);
    if (!before) return jsonError("Subscriber not found", 404);
  }

  // ── Build history entry ───────────────────────────────────────────────────────
  const historyEntry = {
    assignedSalesId:          assignedSalesId   ?? null,
    assignedSalesName:        assignedSalesName ?? null,
    assignedNutritionistId:   assignedNutritionistId   ?? null,
    assignedNutritionistName: assignedNutritionistName ?? null,
    assignedTeamId:           assignedTeamId   ?? null,
    assignedTeamName:         assignedTeamName ?? null,
    assignmentType,
    actorId:   actor.uid,
    actorName: actor.email ?? actor.uid,
    reason:    reason ?? null,
    timestamp: new Date().toISOString(),
  };

  // ── Update subscriber document ────────────────────────────────────────────────
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    assignedSalesId:          assignedSalesId          ?? null,
    assignedSalesName:        assignedSalesName        ?? null,
    assignedNutritionistId:   assignedNutritionistId   ?? null,
    assignedNutritionistName: assignedNutritionistName ?? null,
    assignedTeamId:           assignedTeamId           ?? null,
    assignedTeamName:         assignedTeamName         ?? null,
    assignmentType,
    updatedAt: now,
    updatedBy: actor.uid,
  };

  if (hasAdminCredentials()) {
    const db = getFirestore();
    await db.collection("subscribers").doc(subscriberId).update({
      ...updates,
      assignmentHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    const existing = (before.assignmentHistory as unknown[]) ?? [];
    await fsPatch("subscribers", subscriberId, {
      ...updates,
      assignmentHistory: [...existing, historyEntry],
    }, token);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────────
  const auditDoc = {
    action:     assignmentType === ASSIGNMENT_TYPE.UNASSIGNED ? "subscriber_unassigned" : "subscriber_assigned",
    category:   "subscriber",
    severity:   "info",
    source:     "server",
    entityType: "subscriber",
    entityId:   subscriberId,
    entityName: subscriberName,
    description:`Subscriber ${assignmentType === ASSIGNMENT_TYPE.UNASSIGNED ? "unassigned" : `assigned to ${assignedSalesName ?? assignedNutritionistName ?? assignmentType}`}`,
    performedBy:{ uid:actor.uid, name:actor.email ?? actor.uid, email:actor.email ?? "", role:actor.role },
    metadata:   { assignmentType, reason: reason ?? null, assignedSalesId, assignedNutritionistId },
    tags:       ["subscriber", "assignment"],
    status:     "completed",
    actorUid:   actor.uid, actorName: actor.email ?? actor.uid, actorRole: actor.role,
    targetType: "subscriber", targetId: subscriberId, targetName: subscriberName,
    summary:    `Assignment updated for ${subscriberName}`,
    createdAt:  now,
  };

  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("auditLogs").add({
        ...auditDoc,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await fsAdd("auditLogs", auditDoc, token);
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true });
}
