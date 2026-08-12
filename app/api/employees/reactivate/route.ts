import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { restoreAuthAccess } from "@/lib/revokeAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { guardTargetedRoute, jsonError } from "@/lib/employeeAdminGuard";
import { reactivateEmployeeSchema } from "@/features/users/schemas";
import { writeUserAudit } from "@/lib/serverAudit";
import { COLLECTIONS } from "@/constants/collections";

export const runtime = "nodejs";

/**
 * Restore access to a disabled, suspended, pending or archived account.
 *
 * Three fields carry the account state and all three are written here. Setting
 * only `active` — which the old toggle did — leaves `status: "disabled"`
 * behind, and `status` is what verifyServerUser() and firestore.rules read, so
 * the account stayed locked out while every screen showed it as restored.
 *
 * `deleted` is cleared too. Archiving is reversible by design: the uid is kept
 * precisely so the account can come back with its history intact, and an
 * archive with no way out is a delete with extra steps.
 *
 * Re-enabling the Firebase Auth identity is best-effort and logged in the audit
 * metadata. If it fails the Firestore state is still correct and the account is
 * simply unable to sign in — visible, diagnosable, and fixable by re-running
 * this route, which is a better failure than a half-restored account that
 * reports success.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-reactivate:${ip}`, 10, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = reactivateEmployeeSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { uid, reason } = parsed.data;

  const guard = await guardTargetedRoute(request, uid, {
    permission:   ["users", "activateAccounts"],
    forbidSelf:   true,
    protectOwner: true,
  });
  if (guard instanceof NextResponse) return guard;
  const { actor, target } = guard;

  if (target.status === "active") {
    return NextResponse.json({ success: true, alreadyActive: true });
  }

  const wasArchived = target.status === "deleted";

  await getFirestore().collection(COLLECTIONS.USERS).doc(uid).update({
    status:    "active",
    active:    true,
    deleted:   false,
    deletedAt: FieldValue.delete(),
    deletedBy: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  });

  const { authEnabled } = await restoreAuthAccess(uid);

  await writeUserAudit(actor, {
    action:      "account_activated",
    severity:    "info",
    targetUid:   uid,
    targetName:  target.name,
    description: wasArchived
      ? `تمت استعادة الحساب المؤرشف: ${target.name}`
      : `تمت إعادة تفعيل حساب: ${target.name}`,
    metadata: {
      previousStatus: target.status,
      wasArchived,
      authEnabled,
      reason: reason ?? null,
    },
    tags: ["user", "reactivated"],
  });

  return NextResponse.json({ success: true, authEnabled, wasArchived });
}
