import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission } from "@/lib/serverAuth";
import {
  canManageRole,
  canAssignRole,
  EMPLOYEE_AUTH_ROLE,
  EMPLOYEE_ROLE_PERMISSIONS,
} from "@/lib/permissions";
import { updateEmployeeSchema } from "@/features/users/schemas";
import { granularPermissionsSchema } from "@/features/users/schemas";
import { z } from "zod";
import type { EmployeeRole, GranularPermissions, Role } from "@/types";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// Accept updateEmployeeSchema OR a permissions-only payload
const bodySchema = updateEmployeeSchema.extend({
  granularPermissions: granularPermissionsSchema.optional(),
});
type Body = z.infer<typeof bodySchema>;

export async function POST(request: Request): Promise<NextResponse> {
  // ── 1. Authenticate ──────────────────────────────────────────────────────────
  let actor;
  try {
    actor = await verifyServerUser(request);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!actor) return jsonError("Unauthorized", 401);

  if (!hasServerPermission(actor, "users", "manage")) {
    return jsonError("Forbidden", 403);
  }

  // ── 2. Validate body ─────────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(first?.message ?? "Validation error", 422);
  }

  const input: Body = parsed.data;
  const db = getFirestore();

  // ── 3. Fetch target user ─────────────────────────────────────────────────────
  const targetSnap = await db.collection("users").doc(input.uid).get();
  if (!targetSnap.exists) return jsonError("User not found", 404);
  if (input.uid === actor.uid) return jsonError("Cannot edit your own account here", 400);

  const targetData = targetSnap.data() as { role?: Role; name?: string; employeeRole?: EmployeeRole };
  const targetRole = targetData.role ?? "employee";

  if (!canManageRole(actor.role, targetRole)) {
    return jsonError("Forbidden: insufficient rank", 403);
  }

  // ── 4. Build Firestore update payload ────────────────────────────────────────
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  };

  if (input.employeeRole !== undefined) {
    const newAuthRole = EMPLOYEE_AUTH_ROLE[input.employeeRole];
    if (!canAssignRole(actor.role, newAuthRole)) {
      return jsonError("Forbidden: cannot assign this role", 403);
    }
    update.employeeRole        = input.employeeRole;
    update.role                = newAuthRole;
    update.granularPermissions = EMPLOYEE_ROLE_PERMISSIONS[input.employeeRole];
  }

  // Granular permissions override (owner-only)
  if (input.granularPermissions !== undefined) {
    if (actor.role !== "owner") return jsonError("Only owner can set granular permissions", 403);
    update.granularPermissions = input.granularPermissions as GranularPermissions;
  }

  if (input.department !== undefined) update.department = input.department;
  if (input.notes      !== undefined) update.notes      = input.notes;
  if (input.phone      !== undefined) update.phone      = input.phone;

  // teamId: allow null (removes team assignment) or a string
  if (Object.prototype.hasOwnProperty.call(input, "teamId")) {
    update.teamId = input.teamId ?? null;
  }

  if (Object.keys(update).length <= 2) {
    return jsonError("No fields to update", 400);
  }

  await db.collection("users").doc(input.uid).update(update);

  // ── 5. Audit ─────────────────────────────────────────────────────────────────
  const changedFields = Object.keys(update).filter((k) => k !== "updatedAt" && k !== "updatedBy");
  await db.collection("auditLogs").add({
    action:      "user_updated",
    category:    "user",
    severity:    "info",
    source:      "server",
    entityType:  "user",
    entityId:    input.uid,
    entityName:  targetData.name ?? input.uid,
    description: `Employee updated — fields: ${changedFields.join(", ")}`,
    performedBy: {
      uid:   actor.uid,
      name:  actor.email ?? actor.uid,
      email: actor.email ?? "",
      role:  actor.role,
    },
    metadata:     { changedFields },
    tags:         ["employee", "updated"],
    status:       "completed",
    actorUid:     actor.uid,
    actorName:    actor.email ?? actor.uid,
    actorRole:    actor.role,
    targetType:   "user",
    targetId:     input.uid,
    targetName:   targetData.name ?? input.uid,
    summary:      `Employee ${targetData.name ?? input.uid} updated`,
    createdAt:    FieldValue.serverTimestamp(),
  }).catch(() => undefined);

  return NextResponse.json({ success: true });
}
