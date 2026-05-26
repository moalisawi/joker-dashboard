import { NextResponse } from "next/server";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, getBearerToken } from "@/lib/serverAuth";
import { hasAdminCredentials, fsSet, fsAdd } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
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

// ─── Create Firebase Auth user ────────────────────────────────────────────────

async function createAuthUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  if (hasAdminCredentials()) {
    const user = await getAdminAuth().createUser({ email, password, displayName });
    return user.uid;
  }

  // Fallback: Firebase Auth REST API (no admin credentials needed)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password, displayName, returnSecureToken: false }),
    }
  );
  const data = await res.json() as { localId?: string; error?: { message?: string } };
  if (!res.ok || !data.localId) {
    throw new Error(data.error?.message ?? "Failed to create auth user");
  }
  return data.localId;
}

// ─── Delete Firebase Auth user (rollback) ────────────────────────────────────

async function deleteAuthUser(uid: string): Promise<void> {
  if (hasAdminCredentials()) {
    await getAdminAuth().deleteUser(uid).catch(() => undefined);
    return;
  }
  // Without admin credentials, we can't delete the auth user.
  // Log a warning — the orphaned auth account will need manual cleanup.
  console.warn(`[employees/create] Rollback needed: delete auth user ${uid} manually.`);
}

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit: 10 employee creations per IP per minute
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-create:${ip}`, 10, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  // ── 1. Authenticate caller ───────────────────────────────────────────────────
  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);
  if (!hasServerPermission(actor, "users", "manage")) return jsonError("Forbidden", 403);

  // In production, Admin SDK credentials are required for employee creation.
  // The REST API fallback uses the public API key which bypasses Admin audit logging
  // and creates auth users without the Firestore document atomically.
  if (process.env.NODE_ENV === "production" && !hasAdminCredentials()) {
    return jsonError("Server configuration error: Admin credentials required", 503);
  }

  const token = getBearerToken(request)!;

  // ── 2. Validate body ─────────────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = createEmployeeSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { email, password, fullName, phone, employeeRole, department, teamId, notes } = parsed.data;
  const targetRole        = EMPLOYEE_AUTH_ROLE[employeeRole];
  const granularPerms     = EMPLOYEE_ROLE_PERMISSIONS[employeeRole];

  if (!canAssignRole(actor.role, targetRole)) return jsonError("Forbidden: cannot assign this role", 403);

  // ── 3. Duplicate email guard ─────────────────────────────────────────────────
  if (hasAdminCredentials()) {
    const existing = await getFirestore()
      .collection("users").where("email", "==", email).limit(1).get();
    if (!existing.empty) return jsonError("Email already registered", 409);
  }

  // ── 4. Create Firebase Auth user ─────────────────────────────────────────────
  let uid: string;
  try {
    uid = await createAuthUser(email, password, fullName);
  } catch (err) {
    return jsonError(`Auth creation failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }

  // ── 5. Write Firestore user document ─────────────────────────────────────────
  const now = new Date().toISOString();
  const userDoc = {
    email,
    name:                fullName,
    employeeName:        fullName,
    phone:               phone    ?? null,
    teamId:              teamId   ?? null,
    isEmployee:          true,
    employeeRole,
    department,
    notes:               notes    ?? "",
    role:                targetRole,
    granularPermissions: granularPerms,
    status:              "active",
    active:              true,
    createdBy:           actor.uid,
    createdAt:           now,
    updatedAt:           now,
  };

  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("users").doc(uid).set({
        ...userDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await fsSet("users", uid, userDoc, token);
    }
  } catch (err) {
    await deleteAuthUser(uid);
    return jsonError(`Firestore write failed (Auth user rolled back): ${err instanceof Error ? err.message : String(err)}`, 500);
  }

  // ── 6. Audit log ─────────────────────────────────────────────────────────────
  const auditDoc = {
    action:      "user_created",
    category:    "user",
    severity:    "info",
    source:      "server",
    entityType:  "user",
    entityId:    uid,
    entityName:  fullName,
    description: `Employee created: ${fullName} (${email}) — role: ${employeeRole}`,
    performedBy: { uid: actor.uid, name: actor.email ?? actor.uid, email: actor.email ?? "", role: actor.role },
    metadata:    { employeeRole, department, teamId: teamId ?? null },
    tags:        ["employee", "created"],
    status:      "completed",
    actorUid:    actor.uid,
    actorName:   actor.email ?? actor.uid,
    actorRole:   actor.role,
    targetType:  "user",
    targetId:    uid,
    targetName:  fullName,
    summary:     `Employee ${fullName} created`,
    createdAt:   now,
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
  } catch { /* audit failure must not block the response */ }

  return NextResponse.json({ success: true, uid });
}
