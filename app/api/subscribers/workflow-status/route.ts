import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsPatch, fsAdd } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { z } from "zod";
import { WORKFLOW_STATUS } from "@/constants/subscriberWorkflow";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

const bodySchema = z.object({
  subscriberId:   z.string().min(1),
  subscriberName: z.string().default(""),
  status:         z.enum(["new","interested","follow_up","awaiting_payment","active","paused","completed","cancelled","refunded"]),
  note:           z.string().max(500).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`workflow-status:${ip}`, 60, 60 * 1000))) return jsonError("Too many requests", 429);

  // ── Auth ──────────────────────────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);

  const canChange = hasServerPermission(actor, "subscribers", "changeStatus")
                 || hasServerPermission(actor, "subscribers", "edit")
                 || actor.role === "owner"
                 || actor.role === "admin";
  if (!canChange) return jsonError("Forbidden", 403);

  const token = getBearerToken(request)!;

  // ── Validate ──────────────────────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { subscriberId, subscriberName, status, note } = parsed.data;
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    workflowStatus:          status,
    workflowStatusChangedAt: now,
    workflowStatusChangedBy: actor.uid,
    workflowStatusNote:      note ?? null,
    updatedAt:               now,
    updatedBy:               actor.uid,
  };

  if (hasAdminCredentials()) {
    await getFirestore().collection("subscribers").doc(subscriberId).update({
      ...updates,
      workflowStatusChangedAt: FieldValue.serverTimestamp(),
      updatedAt:               FieldValue.serverTimestamp(),
    });
  } else {
    await fsPatch("subscribers", subscriberId, updates, token);
  }

  // ── Audit ─────────────────────────────────────────────────────────────────────
  const auditDoc = {
    action: "subscriber_status_changed", category: "subscriber", severity: "info", source: "server",
    entityType: "subscriber", entityId: subscriberId, entityName: subscriberName,
    description: `Workflow status changed to "${status}" for ${subscriberName}`,
    performedBy:{ uid:actor.uid, name:actor.email ?? actor.uid, email:actor.email ?? "", role:actor.role },
    metadata: { newStatus: status, note: note ?? null },
    tags: ["subscriber","workflow","status"],
    status: "completed",
    actorUid: actor.uid, actorName: actor.email ?? actor.uid, actorRole: actor.role,
    targetType: "subscriber", targetId: subscriberId, targetName: subscriberName,
    summary: `Status → ${status}`,
    createdAt: now,
  };
  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("auditLogs").add({ ...auditDoc, createdAt: FieldValue.serverTimestamp() });
    } else {
      await fsAdd("auditLogs", auditDoc, token);
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true });
}
