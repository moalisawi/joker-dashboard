import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { revokeAuthAccess } from "@/lib/revokeAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { guardTargetedRoute, jsonError, loadTargetUser } from "@/lib/employeeAdminGuard";
import { deactivateEmployeeSchema } from "@/features/users/schemas";
import { writeUserAudit } from "@/lib/serverAudit";
import { runTransfer } from "@/lib/transferData";
import { buildImpactSummary } from "@/lib/userImpact";
import { COLLECTIONS } from "@/constants/collections";

export const runtime = "nodejs";

/**
 * Withdraw a person's access without touching anything they produced.
 *
 * Deactivation is the reversible half of the lifecycle: nothing is deleted,
 * every uid reference stays valid, and /api/employees/reactivate puts it all
 * back. What changes is the three places access is decided —
 *
 *   status/active   read by verifyServerUser() and by firestore.rules
 *   Auth `disabled` stops a new sign-in
 *   refresh tokens  stops the sessions already open
 *
 * — and it is the third that used to be missing. Flipping the Firestore flag
 * alone left anyone already signed in with a valid ID token for up to an hour,
 * which is the whole window that matters when someone is being walked out.
 *
 * Optionally hands the account's assigned work over first; see
 * transferToUid in deactivateEmployeeSchema.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-deactivate:${ip}`, 10, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = deactivateEmployeeSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { uid, reason, transferToUid, transferScopes } = parsed.data;

  const guard = await guardTargetedRoute(request, uid, {
    permission:   ["users", "activateAccounts"],
    forbidSelf:   true,
    protectOwner: true,
  });
  if (guard instanceof NextResponse) return guard;
  const { actor, target } = guard;

  if (target.deleted) return jsonError("الحساب مؤرشف بالفعل", 400);

  // ── Optional hand-over, before access is withdrawn ──────────────────────────
  let transferred: { scope: string; label: string; moved: number }[] = [];
  if (transferToUid && transferScopes?.length) {
    const recipient = await loadTargetUser(transferToUid);
    if (!recipient) return jsonError("الموظف المستلم غير موجود", 404);
    if (recipient.deleted || recipient.status !== "active") {
      return jsonError("لا يمكن النقل إلى حساب غير نشط", 400);
    }
    if (recipient.uid === uid) return jsonError("لا يمكن النقل إلى نفس الموظف", 400);

    transferred = await runTransfer(actor, {
      fromUid: uid, fromName: target.name,
      toUid: transferToUid, toName: recipient.name,
      scopes: transferScopes, reason, context: "deactivate",
    });
  }

  // Recorded in the audit entry so the log says what was left attached, not just
  // that an account was switched off.
  const impact = await buildImpactSummary(uid);

  await getFirestore().collection(COLLECTIONS.USERS).doc(uid).update({
    status:    "disabled",
    active:    false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  });

  const revocation = await revokeAuthAccess(uid);

  await writeUserAudit(actor, {
    action:      "account_disabled",
    severity:    "warning",
    targetUid:   uid,
    targetName:  target.name,
    description: reason
      ? `تم تعطيل حساب ${target.name} — السبب: ${reason}`
      : `تم تعطيل حساب ${target.name}`,
    metadata: {
      reason: reason ?? null,
      authDisabled:  revocation.authDisabled,
      tokensRevoked: revocation.tokensRevoked,
      previousStatus: target.status,
      remainingAssignments: impact.transferableTotal,
      ledTeams: impact.ledTeams.map((t) => t.name),
      transferred: transferred.length
        ? Object.fromEntries(transferred.map((t) => [t.scope, t.moved]))
        : null,
    },
    tags: ["user", "deactivated"],
  });

  return NextResponse.json({
    success: true,
    ...revocation,
    transferred,
    remainingAssignments: impact.transferableTotal,
  });
}
