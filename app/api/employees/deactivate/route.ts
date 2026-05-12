import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission } from "@/lib/serverAuth";
import { canManageRole } from "@/lib/permissions";
import { deactivateEmployeeSchema } from "@/features/users/schemas";
import type { Role } from "@/types";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── 1. Authenticate ──────────────────────────────────────────────────────────
  let actor;
  try {
    actor = await verifyServerUser(request);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!actor) return jsonError("Unauthorized", 401);

  if (!hasServerPermission(actor, "users", "activateAccounts")) {
    return jsonError("Forbidden", 403);
  }

  // ── 2. Validate ──────────────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = deactivateEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return jsonError(first?.message ?? "Validation error", 422);
  }

  const { uid, reason } = parsed.data;

  if (uid === actor.uid) {
    return jsonError("Cannot deactivate your own account", 400);
  }

  // ── 3. Fetch target ──────────────────────────────────────────────────────────
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return jsonError("User not found", 404);

  const data = snap.data() as { role?: Role; name?: string };
  if (!canManageRole(actor.role, data.role ?? "employee")) {
    return jsonError("Forbidden: insufficient rank", 403);
  }

  // ── 4. Deactivate (soft — account preserved) ────────────────────────────────
  await db.collection("users").doc(uid).update({
    active:    false,
    status:    "disabled",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  });

  // ── 5. Audit ─────────────────────────────────────────────────────────────────
  await db.collection("auditLogs").add({
    action:      "account_disabled",
    category:    "user",
    severity:    "warning",
    source:      "server",
    entityType:  "user",
    entityId:    uid,
    entityName:  data.name ?? uid,
    description: reason
      ? `Employee deactivated — reason: ${reason}`
      : "Employee deactivated",
    performedBy: {
      uid:   actor.uid,
      name:  actor.email ?? actor.uid,
      email: actor.email ?? "",
      role:  actor.role,
    },
    metadata:   { reason: reason ?? null },
    tags:       ["employee", "deactivated"],
    status:     "completed",
    actorUid:   actor.uid,
    actorName:  actor.email ?? actor.uid,
    actorRole:  actor.role,
    targetType: "user",
    targetId:   uid,
    targetName: data.name ?? uid,
    summary:    `Employee ${data.name ?? uid} deactivated`,
    createdAt:  FieldValue.serverTimestamp(),
  }).catch(() => undefined);

  return NextResponse.json({ success: true });
}
