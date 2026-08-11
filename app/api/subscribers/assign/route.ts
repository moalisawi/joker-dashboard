import { NextResponse }  from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsGet, fsPatch, fsAdd }           from "@/lib/serverFirestore";
import { canAssignSubscriberTo, type SubscriberLinkFields }     from "@/lib/serverSubscriberAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
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
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`assign:${ip}`, 60, 60 * 1000))) return jsonError("Too many requests", 429);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);

  // `subscribers.assign` and `subscribers.transfer` are declared in
  // types/permissions.ts but no table populates them — not ROLE_CEILING, not
  // DEFAULT_GRANULAR_PERMISSIONS, not any job preset. Both checks were
  // therefore always false, and the route ran entirely on the `|| edit` and
  // `|| owner || admin` fallbacks beside them. Keeping dead conditions in an
  // authorization path is how someone later concludes a permission is enforced
  // when it is not; the same mistake silently locked admins out of assigning a
  // WhatsApp lead.
  //
  // The capability is `edit`; who may be assigned to whom is canAssignSubscriberTo
  // below, which is enforceable and tested.
  if (!hasServerPermission(actor, "subscribers", "edit")
      && actor.role !== "owner"
      && actor.role !== "admin") {
    return jsonError("Forbidden", 403);
  }

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

  // Reassignment is the sharpest of these operations: the route wrote whatever
  // ids the body carried, so an employee holding subscribers.assign could point
  // any subscriber at themselves — taking over a colleague's record — or hand
  // one to a third party. Ownership of the record is required, and an employee
  // may only assign to themselves or unassign; moving a subscriber between
  // people is a supervisor action.
  const assignDecision = canAssignSubscriberTo(
    actor,
    before as SubscriberLinkFields,
    [assignedSalesId, assignedNutritionistId]
  );
  if (!assignDecision.allowed) return jsonError(assignDecision.reason ?? "Forbidden", 403);

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

  // ── Write immutable assignment history record (Admin SDK) ────────────────────
  const assignmentRecord = {
    subscriberId,
    subscriberName,
    fromTeamId:          (before?.assignedTeamId        as string | null) ?? null,
    fromTeamName:        (before?.assignedTeamName      as string | null) ?? null,
    fromEmployeeId:      (before?.assignedSalesId       as string | null) ?? (before?.assignedNutritionistId as string | null) ?? null,
    fromEmployeeName:    (before?.assignedSalesName     as string | null) ?? (before?.assignedNutritionistName as string | null) ?? null,
    fromAssignmentType:  (before?.assignmentType        as string | null) ?? null,
    toTeamId:            assignedTeamId          ?? null,
    toTeamName:          assignedTeamName        ?? null,
    toEmployeeId:        assignedSalesId         ?? assignedNutritionistId         ?? null,
    toEmployeeName:      assignedSalesName       ?? assignedNutritionistName       ?? null,
    toAssignmentType:    assignmentType,
    reason:              reason                  ?? null,
    transferredBy:       actor.uid,
    transferredByName:   actor.email             ?? actor.uid,
  };

  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("subscriberAssignments").add({
        ...assignmentRecord,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await fsAdd("subscriberAssignments", { ...assignmentRecord, createdAt: new Date().toISOString() }, token);
    }
  } catch { /* non-fatal — subscriber update already succeeded */ }

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
