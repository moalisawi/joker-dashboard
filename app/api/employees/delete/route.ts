import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { revokeAuthAccess } from "@/lib/revokeAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { guardTargetedRoute, jsonError, loadTargetUser } from "@/lib/employeeAdminGuard";
import { archiveEmployeeSchema } from "@/features/users/schemas";
import { writeUserAudit } from "@/lib/serverAudit";
import { runTransfer } from "@/lib/transferData";
import { buildImpactSummary } from "@/lib/userImpact";
import { COLLECTIONS } from "@/constants/collections";

export const runtime = "nodejs";

/**
 * Archive an account. Never a hard delete.
 *
 * The document stays, the uid stays, and every subscriber, payment and audit
 * entry that names this person keeps resolving to a readable record. Removing
 * the document would turn years of history into dangling ids — the "who sold
 * this" column would go blank across the whole archive — for no gain, since
 * access is already fully withdrawn by the same three flags deactivation uses.
 *
 * Two refusals that are not negotiable:
 *
 *  • Owners cannot be archived through this route at all. There is no
 *    "last owner" check that would be safe here, and an installation with no
 *    reachable owner cannot grant anyone the permission to fix itself.
 *  • An account with live assignments is refused unless the caller either names
 *    a recipient or explicitly sets keepAssignments. The previous version
 *    archived silently, which is how work disappears from every queue while
 *    still formally belonging to someone who no longer exists.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-delete:${ip}`, 5, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = archiveEmployeeSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { uid, reason, transferToUid, transferScopes, keepAssignments } = parsed.data;

  const guard = await guardTargetedRoute(request, uid, {
    permission: ["users", "manage"],
    ownerOnly:  true,
    forbidSelf: true,
  });
  if (guard instanceof NextResponse) return guard;
  const { actor, target } = guard;

  if (target.role === "owner") return jsonError("لا يمكن أرشفة حساب مالك", 403);
  if (target.deleted)          return jsonError("الحساب مؤرشف بالفعل", 400);

  // ── Hand-over first, so nothing is orphaned mid-operation ───────────────────
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
      scopes: transferScopes, reason, context: "archive",
    });
  }

  // Re-counted after the transfer: what is reported is what actually remains.
  const impact = await buildImpactSummary(uid);

  if (impact.transferableTotal > 0 && !keepAssignments) {
    return NextResponse.json(
      {
        success: false,
        error: "الحساب ما زال مرتبطاً ببيانات — انقلها أو أكّد الاحتفاظ بها",
        code: "ASSIGNMENTS_PENDING",
        impact,
      },
      { status: 409 }
    );
  }

  await getFirestore().collection(COLLECTIONS.USERS).doc(uid).update({
    deleted:   true,
    active:    false,
    status:    "deleted",
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  });

  const revocation = await revokeAuthAccess(uid);

  /**
   * A team whose `leaderId` points at an archived account is a dangling
   * pointer: the team page renders a leader who cannot sign in, and nothing
   * ever prompts anyone to replace them.
   *
   * Cleared here and not on deactivate — deactivation is reversible and
   * routinely temporary (leave, suspension pending review), so dropping the
   * leader would be a destructive side effect of a reversible act. Archiving is
   * the end of the account, so the pointer has to go. The team is left with no
   * leader rather than a guessed one; picking a successor is a judgement the
   * owner makes on the teams page, and the audit entry names what was cleared.
   */
  const clearedTeams: string[] = [];
  for (const t of impact.ledTeams) {
    try {
      await getFirestore().collection(COLLECTIONS.TEAMS).doc(t.id).update({
        leaderId:  null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
      clearedTeams.push(t.name);
    } catch { /* reported below via the count mismatch */ }
  }

  await writeUserAudit(actor, {
    action:      "employee_archived",
    severity:    "critical",
    targetUid:   uid,
    targetName:  target.name,
    description: `تمت أرشفة حساب ${target.name}${reason ? ` — السبب: ${reason}` : ""}`,
    metadata: {
      reason: reason ?? null,
      authDisabled:  revocation.authDisabled,
      tokensRevoked: revocation.tokensRevoked,
      previousStatus: target.status,
      keptAssignments: impact.transferableTotal,
      ledTeams: impact.ledTeams.map((t) => t.name),
      clearedTeamLeadership: clearedTeams.length ? clearedTeams : null,
      transferred: transferred.length
        ? Object.fromEntries(transferred.map((t) => [t.scope, t.moved]))
        : null,
    },
    tags: ["user", "archived"],
  });

  return NextResponse.json({
    success: true,
    ...revocation,
    transferred,
    keptAssignments: impact.transferableTotal,
    clearedTeamLeadership: clearedTeams,
  });
}
