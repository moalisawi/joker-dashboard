import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission } from "@/lib/serverAuth";
import {
  EMPLOYEE_AUTH_ROLE,
  EMPLOYEE_ROLE_PERMISSIONS,
  canAssignRole,
} from "@/lib/permissions";
import { createEmployeeSchema } from "@/features/users/schemas";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── 1. Authenticate caller ───────────────────────────────────────────────────
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

  // ── 2. Parse & validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(first?.message ?? "Validation error", 422);
  }

  const { email, password, fullName, phone, employeeRole, department, teamId, notes } = parsed.data;

  // ── 3. Role hierarchy check ──────────────────────────────────────────────────
  const targetRole = EMPLOYEE_AUTH_ROLE[employeeRole];
  if (!canAssignRole(actor.role, targetRole)) {
    return jsonError("Forbidden: cannot assign this role", 403);
  }

  // ── 4. Duplicate email guard ─────────────────────────────────────────────────
  const db   = getFirestore();
  const authAdmin = getAuth();

  const existing = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!existing.empty) {
    return jsonError("Email already registered", 409);
  }

  // ── 5. Create Firebase Auth user ─────────────────────────────────────────────
  let authUser;
  try {
    authUser = await authAdmin.createUser({
      email,
      password,
      displayName: fullName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(`Auth creation failed: ${msg}`, 500);
  }

  // ── 6. Create Firestore document (rollback Auth user on failure) ─────────────
  try {
    await db.collection("users").doc(authUser.uid).set({
      email,
      name: fullName,
      employeeName: fullName,
      phone:        phone ?? null,
      teamId:       teamId ?? null,
      isEmployee:   true,
      employeeRole,
      department,
      notes:        notes ?? "",
      role:         targetRole,
      granularPermissions: EMPLOYEE_ROLE_PERMISSIONS[employeeRole],
      status:       "active",
      active:       true,
      createdBy:    actor.uid,
      createdAt:    FieldValue.serverTimestamp(),
      updatedAt:    FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Rollback: delete the Auth user so it doesn't become an orphan
    await authAdmin.deleteUser(authUser.uid).catch(() => undefined);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(`Firestore write failed (Auth user rolled back): ${msg}`, 500);
  }

  // ── 7. Audit log ─────────────────────────────────────────────────────────────
  await db.collection("auditLogs").add({
    action:      "user_created",
    category:    "user",
    severity:    "info",
    source:      "server",
    entityType:  "user",
    entityId:    authUser.uid,
    entityName:  fullName,
    description: `Employee created: ${fullName} (${email}) — role: ${employeeRole}`,
    performedBy: {
      uid:   actor.uid,
      name:  actor.email ?? actor.uid,
      email: actor.email ?? "",
      role:  actor.role,
    },
    metadata: { employeeRole, department, teamId: teamId ?? null },
    tags:     ["employee", "created"],
    status:   "completed",
    // legacy mirror fields
    actorUid:   actor.uid,
    actorName:  actor.email ?? actor.uid,
    actorRole:  actor.role,
    targetType: "user",
    targetId:   authUser.uid,
    targetName: fullName,
    summary:    `Employee ${fullName} created`,
    createdAt:  FieldValue.serverTimestamp(),
  }).catch(() => undefined); // audit failure must not block the response

  return NextResponse.json({ success: true, uid: authUser.uid });
}
