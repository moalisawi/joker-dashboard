import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsGet, fsPatch, fsAdd } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { Role } from "@/types";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ uid: z.string().min(1) });

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-delete:${ip}`, 5, 60 * 1000))) return jsonError("Too many requests", 429);

  // ── 1. Auth — owner only ─────────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);
  if (actor.role !== "owner") return jsonError("Forbidden: only owner can delete employees", 403);

  const token = getBearerToken(request)!;

  // ── 2. Validate ──────────────────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { uid } = parsed.data;
  if (uid === actor.uid) return jsonError("Cannot delete your own account", 400);

  // ── 3. Fetch target ──────────────────────────────────────────────────────────
  type TargetData = { role?: Role; name?: string; isEmployee?: boolean };
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

  if (targetData.role === "owner") return jsonError("Cannot delete another owner", 403);

  // ── 4. Soft-delete: mark deleted in Firestore + disable Firebase Auth ────────
  const now = new Date().toISOString();
  const update = {
    deleted: true,
    active: false,
    status: "deleted",
    deletedAt: now,
    deletedBy: actor.uid,
    updatedAt: now,
  };

  if (hasAdminCredentials()) {
    await getFirestore().collection("users").doc(uid).update({
      ...update,
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Disable Firebase Auth account so they can't log in
    try { await getAuth().updateUser(uid, { disabled: true }); } catch { /* non-fatal */ }
  } else {
    await fsPatch("users", uid, update, token);
  }

  // ── 5. Audit ─────────────────────────────────────────────────────────────────
  const auditDoc = {
    action: "employee_deleted", category: "user", severity: "critical", source: "server",
    entityType: "user", entityId: uid, entityName: targetData.name ?? uid,
    description: `Employee ${targetData.name ?? uid} permanently deleted by owner`,
    performedBy: { uid: actor.uid, name: actor.email ?? actor.uid, email: actor.email ?? "", role: actor.role },
    metadata: {}, tags: ["employee", "deleted"], status: "completed",
    actorUid: actor.uid, actorName: actor.email ?? actor.uid, actorRole: actor.role,
    targetType: "user", targetId: uid, targetName: targetData.name ?? uid,
    summary: `Employee ${targetData.name ?? uid} deleted`, createdAt: now,
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
