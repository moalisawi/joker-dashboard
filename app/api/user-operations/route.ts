import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { createServerNotification } from "@/lib/serverNotification";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  EMPLOYEE_AUTH_ROLE,
  EMPLOYEE_ROLE_PERMISSIONS,
  canAssignRole,
  canManageRole,
  getDefaultGranularPermissions,
} from "@/lib/permissions";
import type { AccountStatus, EmployeeDepartment, EmployeeRole, GranularPermissions, Role } from "@/types";

export const runtime = "nodejs";

type Operation =
  | "setStatus"
  | "setRole"
  | "setGranularPermissions"
  | "resetPermissions"
  | "updateProfile"
  | "saveEmployee"
  | "toggleEmployee"
  | "demoteEmployee";

type Body = {
  operation: Operation;
  payload?: Record<string, unknown>;
};

type ServerUser = NonNullable<Awaited<ReturnType<typeof verifyServerUser>>>;

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function actorName(user: ServerUser) {
  return user.email || user.uid;
}

async function getTarget(uid: string) {
  const snap = await getFirestore().collection("users").doc(uid).get();
  if (!snap.exists) throw new Error("User not found");
  return { uid: snap.id, ...(snap.data() ?? {}) } as { uid: string; role?: Role; name?: string; active?: boolean };
}

function assertCanManageUsers(user: ServerUser) {
  if (!hasServerPermission(user, "users", "manage")) {
    throw new Error("Forbidden");
  }
}

function sanitizeForFirestore(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
  );
}

async function writeAudit(
  user: ServerUser,
  action: string,
  targetUid: string,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  const performer = {
    uid: user.uid,
    name: actorName(user),
    email: user.email ?? "",
    role: user.role,
  };
  const safeMeta = sanitizeForFirestore(metadata);

  await getFirestore().collection("auditLogs").add({
    action,
    category: "user",
    severity: action.includes("disabled") || action.includes("suspended") ? "warning" : "info",
    source: "server",
    entityType: "user",
    entityId: targetUid,
    entityName: safeMeta.targetName ?? null,
    description,
    previousData: null,
    newData: null,
    changedFields: [],
    performedBy: performer,
    financialData: null,
    metadata: safeMeta,
    tags: ["server-operation", "user"],
    status: "completed",
    actorUid: performer.uid,
    actorName: performer.name,
    actorRole: performer.role,
    targetType: "user",
    targetId: targetUid,
    targetName: safeMeta.targetName ?? null,
    summary: description,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Fire-and-forget notification (non-blocking)
  createServerNotification({
    action,
    entityType:  "user",
    entityId:    targetUid,
    entityName:  metadata.targetName as string | undefined,
    description,
    performedBy: performer,
    metadata,
  }).catch(() => {});
}

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit: 30 user-management operations per IP per minute
  const ip = getClientIp(request);
  if (!checkRateLimit(`user-ops:${ip}`, 30, 60 * 1000)) {
    return jsonError("Too many requests", 429);
  }

  let user;
  try {
    user = await verifyServerUser(request);
  } catch (err) {
    console.error("[user-operations] auth failed:", err);
    return jsonError("Unauthorized", 401);
  }

  if (!user) return jsonError("Unauthorized", 401);

  // All operations write users/auditLogs via Admin SDK only.
  if (!hasAdminCredentials()) {
    return jsonError("Admin credentials غير مفعّلة على السيرفر", 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const payload = asRecord(body.payload);

  try {
    assertCanManageUsers(user);

    switch (body.operation) {
      case "setStatus":
        return NextResponse.json(await setStatus(user, payload));
      case "setRole":
        return NextResponse.json(await setRole(user, payload));
      case "setGranularPermissions":
        return NextResponse.json(await setGranularPermissions(user, payload));
      case "resetPermissions":
        return NextResponse.json(await resetPermissions(user, payload));
      case "updateProfile":
        return NextResponse.json(await updateProfile(user, payload));
      case "saveEmployee":
        return NextResponse.json(await saveEmployee(user, payload));
      case "toggleEmployee":
        return NextResponse.json(await toggleEmployee(user, payload));
      case "demoteEmployee":
        return NextResponse.json(await demoteEmployee(user, payload));
      default:
        return jsonError("Unknown operation", 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "Forbidden" ? 403 : message === "User not found" ? 404 : 500;
    console.error("[user-operations] operation failed:", message);
    // Expose safe domain errors; hide raw Firestore/internal strings
    const SAFE_MESSAGES = new Set([
      "Forbidden", "User not found", "Missing status payload", "Missing role payload",
      "Missing targetUid", "Missing reset payload", "No profile fields to update",
      "Cannot change your own account status", "Cannot change your own role",
      "Cannot change your own permissions", "Cannot manage yourself from employee editor",
      "Cannot demote yourself", "Missing employee email", "USER_NOT_FOUND",
    ]);
    const clientMessage = SAFE_MESSAGES.has(message) ? message : "Operation failed";
    return jsonError(clientMessage, status);
  }
}

async function setStatus(user: ServerUser, payload: Record<string, unknown>) {
  const targetUid = asString(payload.targetUid);
  const newStatus = asString(payload.newStatus) as AccountStatus;
  if (!targetUid || !newStatus) throw new Error("Missing status payload");
  if (targetUid === user.uid) throw new Error("Cannot change your own account status");
  const target = await getTarget(targetUid);
  if (!canManageRole(user.role, target.role ?? "employee")) throw new Error("Forbidden");

  await getFirestore().collection("users").doc(targetUid).update({
    status: newStatus,
    active: newStatus === "active",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, `account_${newStatus}`, targetUid, `Account status changed to ${newStatus}`, {
    targetName: target.name,
    newStatus,
    reason: payload.reason,
  });

  return { success: true };
}

async function setRole(user: ServerUser, payload: Record<string, unknown>) {
  const targetUid = asString(payload.targetUid);
  const newRole = asString(payload.newRole) as Role;
  if (!targetUid || !newRole) throw new Error("Missing role payload");
  if (targetUid === user.uid) throw new Error("Cannot change your own role");
  const target = await getTarget(targetUid);
  const currentRole = target.role ?? "employee";
  if (!canManageRole(user.role, currentRole) || !canAssignRole(user.role, newRole)) {
    throw new Error("Forbidden");
  }

  await getFirestore().collection("users").doc(targetUid).update({
    role: newRole,
    granularPermissions: getDefaultGranularPermissions(newRole),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "role_changed", targetUid, `Role changed ${currentRole} -> ${newRole}`, {
    targetName: target.name,
    previousRole: currentRole,
    newRole,
  });

  return { success: true };
}

async function setGranularPermissions(user: ServerUser, payload: Record<string, unknown>) {
  if (user.role !== "owner") throw new Error("Forbidden");
  const targetUid = asString(payload.targetUid);
  if (!targetUid) throw new Error("Missing targetUid");
  if (targetUid === user.uid) throw new Error("Cannot change your own permissions");
  const permissions = asRecord(payload.permissions) as unknown as GranularPermissions;
  const target = await getTarget(targetUid);

  await getFirestore().collection("users").doc(targetUid).update({
    granularPermissions: permissions,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "permissions_changed", targetUid, "Granular permissions updated", {
    targetName: target.name,
  });

  return { success: true };
}

async function resetPermissions(user: ServerUser, payload: Record<string, unknown>) {
  if (user.role !== "owner") throw new Error("Forbidden");
  const targetUid = asString(payload.targetUid);
  const targetRole = asString(payload.targetRole) as Role;
  if (!targetUid || !targetRole) throw new Error("Missing reset payload");
  const target = await getTarget(targetUid);

  await getFirestore().collection("users").doc(targetUid).update({
    granularPermissions: getDefaultGranularPermissions(targetRole),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "permissions_reset", targetUid, `Permissions reset to ${targetRole}`, {
    targetName: target.name,
    targetRole,
  });

  return { success: true };
}

async function updateProfile(user: ServerUser, payload: Record<string, unknown>) {
  const targetUid = asString(payload.targetUid);
  if (!targetUid) throw new Error("Missing targetUid");
  const target = await getTarget(targetUid);
  if (targetUid !== user.uid && !canManageRole(user.role, target.role ?? "employee")) {
    throw new Error("Forbidden");
  }

  const data = asRecord(payload.data);
  const update: Record<string, unknown> = {};
  if (typeof data.name === "string") update.name = data.name.trim();
  if (typeof data.employeeName === "string") update.employeeName = data.employeeName.trim();
  if (Object.keys(update).length === 0) throw new Error("No profile fields to update");

  await getFirestore().collection("users").doc(targetUid).update({
    ...update,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "user_updated", targetUid, "User profile updated", {
    targetName: target.name,
  });

  return { success: true };
}

async function saveEmployee(user: ServerUser, payload: Record<string, unknown>) {
  const uid = asString(payload.uid);
  const email = asString(payload.email).trim();
  const employeeRole = asString(payload.employeeRole, "sales") as EmployeeRole;
  const department = asString(payload.department, "مبيعات") as EmployeeDepartment;
  const notes = asString(payload.notes);
  const role = EMPLOYEE_AUTH_ROLE[employeeRole];
  const granularPermissions = EMPLOYEE_ROLE_PERMISSIONS[employeeRole];
  let targetUid = uid;

  if (!targetUid) {
    if (!email) throw new Error("Missing employee email");
    const snap = await getFirestore().collection("users").where("email", "==", email).limit(1).get();
    if (snap.empty) throw new Error("USER_NOT_FOUND");
    targetUid = snap.docs[0].id;
  }

  const target = await getTarget(targetUid);
  if (targetUid === user.uid) throw new Error("Cannot manage yourself from employee editor");
  if (!canManageRole(user.role, target.role ?? "employee") || !canAssignRole(user.role, role)) {
    throw new Error("Forbidden");
  }

  await getFirestore().collection("users").doc(targetUid).update({
    isEmployee: true,
    employeeRole,
    department,
    notes,
    role,
    granularPermissions,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, uid ? "user_updated" : "user_created", targetUid, "Employee record saved", {
    targetName: target.name,
    employeeRole,
    department,
  });

  return { success: true, uid: targetUid };
}

async function toggleEmployee(user: ServerUser, payload: Record<string, unknown>) {
  const targetUid = asString(payload.uid);
  const active = Boolean(payload.active);
  if (!targetUid) throw new Error("Missing uid");
  if (targetUid === user.uid) throw new Error("Cannot change your own account status");
  const target = await getTarget(targetUid);
  if (!canManageRole(user.role, target.role ?? "employee")) throw new Error("Forbidden");

  await getFirestore().collection("users").doc(targetUid).update({
    active,
    status: active ? "active" : "disabled",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, active ? "account_activated" : "account_disabled", targetUid, "Employee active status changed", {
    targetName: target.name,
    active,
  });

  return { success: true };
}

async function demoteEmployee(user: ServerUser, payload: Record<string, unknown>) {
  const targetUid = asString(payload.uid);
  if (!targetUid) throw new Error("Missing uid");
  if (targetUid === user.uid) throw new Error("Cannot demote yourself");
  const target = await getTarget(targetUid);
  if (!canManageRole(user.role, target.role ?? "employee")) throw new Error("Forbidden");

  await getFirestore().collection("users").doc(targetUid).update({
    isEmployee: false,
    employeeRole: FieldValue.delete(),
    department: FieldValue.delete(),
    granularPermissions: FieldValue.delete(),
    role: "employee",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "user_updated", targetUid, "Employee demoted to regular user", {
    targetName: target.name,
  });

  return { success: true };
}
