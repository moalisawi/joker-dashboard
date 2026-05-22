import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsGet, fsPatch, fsAdd } from "@/lib/serverFirestore";
import { canManageRole } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { deactivateEmployeeSchema } from "@/features/users/schemas";
import type { Role } from "@/types";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!checkRateLimit(`emp-deactivate:${ip}`, 10, 60 * 1000)) return jsonError("Too many requests", 429);

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);
  if (!hasServerPermission(actor, "users", "activateAccounts")) return jsonError("Forbidden", 403);

  const token = getBearerToken(request)!;

  // ── 2. Validate ──────────────────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = deactivateEmployeeSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { uid, reason } = parsed.data;
  if (uid === actor.uid) return jsonError("Cannot deactivate your own account", 400);

  // ── 3. Fetch target ──────────────────────────────────────────────────────────
  type TargetData = { role?: Role; name?: string };
  let targetData: TargetData | null = null;

  if (hasAdminCredentials()) {
    const snap = await getFirestore().collection("users").doc(uid).get();
    if (!snap.exists) return jsonError("User not found", 404);
    targetData = snap.data() as TargetData;
  } else {
    const raw = await fsGet("users", uid, token);
    if (!raw) return jsonError("User not found", 404);
    targetData = raw as TargetData;
  }

  if (!canManageRole(actor.role, targetData.role ?? "employee")) {
    return jsonError("Forbidden: insufficient rank", 403);
  }

  // ── 4. Deactivate ────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const update = { active: false, status: "disabled", updatedAt: now, updatedBy: actor.uid };

  if (hasAdminCredentials()) {
    await getFirestore().collection("users").doc(uid).update({
      ...update,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await fsPatch("users", uid, update, token);
  }

  // ── 5. Audit ─────────────────────────────────────────────────────────────────
  const auditDoc = {
    action: "account_disabled", category: "user", severity: "warning", source: "server",
    entityType: "user", entityId: uid, entityName: targetData.name ?? uid,
    description: reason ? `Employee deactivated — reason: ${reason}` : "Employee deactivated",
    performedBy: { uid: actor.uid, name: actor.email ?? actor.uid, email: actor.email ?? "", role: actor.role },
    metadata: { reason: reason ?? null }, tags: ["employee", "deactivated"], status: "completed",
    actorUid: actor.uid, actorName: actor.email ?? actor.uid, actorRole: actor.role,
    targetType: "user", targetId: uid, targetName: targetData.name ?? uid,
    summary: `Employee ${targetData.name ?? uid} deactivated`, createdAt: now,
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
