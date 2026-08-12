/**
 * The checks every user-lifecycle route has to pass, in one place.
 *
 * The four routes that existed before each re-implemented this preamble, and the
 * differences between them were not deliberate: `delete` refused to touch
 * another owner but `deactivate` did not, and neither said anything about acting
 * on an already-archived account. A guard that is copied five times is a guard
 * with five versions.
 *
 * Order matters and is fixed here: authenticate, require Admin credentials,
 * check the permission, load the target, then rank. Ranking last means a caller
 * who lacks the permission never learns whether a uid exists.
 */

import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, hasServerPermission, type VerifiedServerUser } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { canManageRole, resolveAccountStatus } from "@/lib/permissions";
import { COLLECTIONS } from "@/constants/collections";
import type { AccountStatus, EmployeeRole, Role } from "@/types";

export interface TargetUser {
  uid: string;
  name: string;
  email?: string;
  role: Role;
  employeeRole?: EmployeeRole;
  status: AccountStatus;
  teamId?: string | null;
  deleted: boolean;
}

export interface GuardOptions {
  /** Granular permission the caller must hold, e.g. ["users", "manage"]. */
  permission: [category: string, action: string];
  /** Refuse when actor and target are the same account. */
  forbidSelf?: boolean;
  /** Refuse when the target is an owner, unless the actor is an owner too. */
  protectOwner?: boolean;
  /** Restrict the whole route to owners (used by archive). */
  ownerOnly?: boolean;
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function loadTargetUser(uid: string): Promise<TargetUser | null> {
  const snap = await getFirestore().collection(COLLECTIONS.USERS).doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  return {
    uid,
    name:         (d.name as string | undefined) ?? (d.employeeName as string | undefined) ?? uid,
    email:        d.email as string | undefined,
    role:         (d.role as Role | undefined) ?? "employee",
    employeeRole: d.employeeRole as EmployeeRole | undefined,
    status:       resolveAccountStatus(d as { status?: string; active?: boolean; deleted?: boolean }),
    teamId:       (d.teamId as string | null | undefined) ?? null,
    deleted:      d.deleted === true,
  };
}

/**
 * Returns the verified actor, or the response to send back.
 *
 * Split from `guardTargetedRoute` so routes that act on no particular user
 * (listing, aggregate reads) get the same preamble without inventing a uid.
 */
export async function guardRoute(
  request: Request,
  options: Pick<GuardOptions, "permission" | "ownerOnly">
): Promise<VerifiedServerUser | NextResponse> {
  let actor: VerifiedServerUser | null;
  try {
    actor = await verifyServerUser(request);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!actor) return jsonError("Unauthorized", 401);

  // Every lifecycle write goes through the Admin SDK: firestore.rules blocks
  // client writes to /users outright, so without credentials the route cannot
  // do its job and must say so rather than half-succeed.
  if (!hasAdminCredentials()) {
    return jsonError("Admin credentials غير مفعّلة على السيرفر", 503);
  }

  if (options.ownerOnly && actor.role !== "owner") {
    return jsonError("Forbidden: owner only", 403);
  }

  const [category, action] = options.permission;
  if (!hasServerPermission(actor, category, action)) return jsonError("Forbidden", 403);

  return actor;
}

export async function guardTargetedRoute(
  request: Request,
  uid: string,
  options: GuardOptions
): Promise<{ actor: VerifiedServerUser; target: TargetUser } | NextResponse> {
  const actor = await guardRoute(request, options);
  if (actor instanceof NextResponse) return actor;

  if (options.forbidSelf && uid === actor.uid) {
    return jsonError("لا يمكنك تنفيذ هذا الإجراء على حسابك الخاص", 400);
  }

  const target = await loadTargetUser(uid);
  if (!target) return jsonError("User not found", 404);

  if (options.protectOwner && target.role === "owner" && actor.role !== "owner") {
    return jsonError("Forbidden: owner accounts are managed by owners only", 403);
  }

  if (!canManageRole(actor.role, target.role)) {
    return jsonError("Forbidden: insufficient rank", 403);
  }

  return { actor, target };
}
