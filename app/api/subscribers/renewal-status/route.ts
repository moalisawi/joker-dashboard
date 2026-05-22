import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsPatch, fsAdd } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { z } from "zod";
import { RENEWAL_STATUS } from "@/constants/subscriberWorkflow";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

const bodySchema = z.object({
  subscriberId:           z.string().min(1),
  subscriberName:         z.string().default(""),
  renewalWorkflowStatus:  z.enum(["pending","contacted","renewed","declined"]),
  renewalNote:            z.string().max(500).optional(),
  renewalHandledBy:       z.string().optional(),
  renewalHandledByName:   z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!checkRateLimit(`renewal-status:${ip}`, 60, 60 * 1000)) return jsonError("Too many requests", 429);

  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);

  const canManage =
    hasServerPermission(actor, "subscriptions", "manageRenewals") ||
    hasServerPermission(actor, "subscriptions", "renew") ||
    actor.role === "owner" ||
    actor.role === "admin";
  if (!canManage) return jsonError("Forbidden", 403);

  const token = getBearerToken(request)!;

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { subscriberId, subscriberName, renewalWorkflowStatus, renewalNote, renewalHandledBy, renewalHandledByName } = parsed.data;
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    renewalWorkflowStatus,
    renewalNote:          renewalNote ?? null,
    renewalHandledBy:     renewalHandledBy ?? actor.uid,
    renewalHandledByName: renewalHandledByName ?? actor.email ?? actor.uid,
    updatedAt:            now,
    updatedBy:            actor.uid,
  };

  if (hasAdminCredentials()) {
    await getFirestore().collection("subscribers").doc(subscriberId).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await fsPatch("subscribers", subscriberId, updates, token);
  }

  const auditDoc = {
    action: "renewal_status_changed", category: "subscriber", severity: "info", source: "server",
    entityType: "subscriber", entityId: subscriberId, entityName: subscriberName,
    description: `Renewal status changed to "${renewalWorkflowStatus}" for ${subscriberName}`,
    performedBy: { uid:actor.uid, name:actor.email ?? actor.uid, email:actor.email ?? "", role:actor.role },
    metadata: { newStatus: renewalWorkflowStatus, note: renewalNote ?? null },
    tags: ["subscriber","renewal","status"],
    status: "completed",
    actorUid: actor.uid, actorName: actor.email ?? actor.uid, actorRole: actor.role,
    targetType: "subscriber", targetId: subscriberId, targetName: subscriberName,
    summary: `Renewal → ${renewalWorkflowStatus}`,
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
