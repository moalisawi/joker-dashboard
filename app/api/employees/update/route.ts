import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsGet, fsPatch, fsAdd } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  canManageRole,
  canAssignRole,
  EMPLOYEE_AUTH_ROLE,
  EMPLOYEE_ROLE_PERMISSIONS,
} from "@/lib/permissions";
import { updateEmployeeSchema, granularPermissionsSchema } from "@/features/users/schemas";
import { z } from "zod";
import type { EmployeeRole, GranularPermissions, Role } from "@/types";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

const bodySchema = updateEmployeeSchema.extend({
  granularPermissions: granularPermissionsSchema.optional(),
});
type Body = z.infer<typeof bodySchema>;

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!checkRateLimit(`emp-update:${ip}`, 30, 60 * 1000)) return jsonError("Too many requests", 429);

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);
  if (!hasServerPermission(actor, "users", "manage")) return jsonError("Forbidden", 403);

  const token = getBearerToken(request)!;

  // ── 2. Validate ──────────────────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const input: Body = parsed.data;
  if (input.uid === actor.uid) return jsonError("Cannot edit your own account here", 400);

  // ── 3. Fetch target ──────────────────────────────────────────────────────────
  type TargetData = { role?: Role; name?: string; employeeRole?: EmployeeRole };
  let targetData: TargetData | null = null;

  if (hasAdminCredentials()) {
    const snap = await getFirestore().collection("users").doc(input.uid).get();
    if (!snap.exists) return jsonError("User not found", 404);
    targetData = snap.data() as TargetData;
  } else {
    const raw = await fsGet("users", input.uid, token);
    if (!raw) return jsonError("User not found", 404);
    targetData = raw as TargetData;
  }

  const targetRole = targetData.role ?? "employee";
  if (!canManageRole(actor.role, targetRole)) return jsonError("Forbidden: insufficient rank", 403);

  // ── 4. Build update payload ──────────────────────────────────────────────────
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updatedAt: now, updatedBy: actor.uid };

  if (input.employeeRole !== undefined) {
    const newAuthRole = EMPLOYEE_AUTH_ROLE[input.employeeRole];
    if (!canAssignRole(actor.role, newAuthRole)) return jsonError("Forbidden: cannot assign this role", 403);
    update.employeeRole        = input.employeeRole;
    update.role                = newAuthRole;
    update.granularPermissions = EMPLOYEE_ROLE_PERMISSIONS[input.employeeRole];
  }

  if (input.granularPermissions !== undefined) {
    if (actor.role !== "owner") return jsonError("Only owner can set granular permissions", 403);
    update.granularPermissions = input.granularPermissions as GranularPermissions;
  }

  if (input.department !== undefined) update.department = input.department;
  if (input.notes      !== undefined) update.notes      = input.notes;
  if (input.phone      !== undefined) update.phone      = input.phone;
  if (Object.prototype.hasOwnProperty.call(input, "teamId")) update.teamId = input.teamId ?? null;

  if (Object.keys(update).length <= 2) return jsonError("No fields to update", 400);

  // ── 5. Write ─────────────────────────────────────────────────────────────────
  if (hasAdminCredentials()) {
    await getFirestore().collection("users").doc(input.uid).update({
      ...update,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await fsPatch("users", input.uid, update, token);
  }

  // ── 6. Audit ─────────────────────────────────────────────────────────────────
  const changed = Object.keys(update).filter((k) => k !== "updatedAt" && k !== "updatedBy");
  const auditDoc = {
    action: "user_updated", category: "user", severity: "info", source: "server",
    entityType: "user", entityId: input.uid, entityName: targetData.name ?? input.uid,
    description: `Employee updated — fields: ${changed.join(", ")}`,
    performedBy: { uid: actor.uid, name: actor.email ?? actor.uid, email: actor.email ?? "", role: actor.role },
    metadata: { changedFields: changed }, tags: ["employee", "updated"], status: "completed",
    actorUid: actor.uid, actorName: actor.email ?? actor.uid, actorRole: actor.role,
    targetType: "user", targetId: input.uid, targetName: targetData.name ?? input.uid,
    summary: `Employee ${targetData.name ?? input.uid} updated`, createdAt: now,
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
