import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { guardTargetedRoute, jsonError, loadTargetUser } from "@/lib/employeeAdminGuard";
import { transferDataSchema } from "@/features/users/schemas";
import { runTransfer } from "@/lib/transferData";

export const runtime = "nodejs";

/**
 * Hand one employee's assigned work to another.
 *
 * Two guards beyond the usual preamble, both learned from what happens without
 * them:
 *
 *  • The recipient must be an active, non-archived account. Transferring a
 *    queue onto a disabled user hides it from every dashboard while leaving it
 *    formally owned — worse than leaving it where it was.
 *  • The caller must outrank the *recipient* as well as the source. Otherwise an
 *    admin could pile an owner's subscribers onto an account they do not
 *    administer.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-transfer:${ip}`, 10, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = transferDataSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const { fromUid, toUid, scopes, reason } = parsed.data;

  const guard = await guardTargetedRoute(request, fromUid, {
    permission: ["users", "manage"],
  });
  if (guard instanceof NextResponse) return guard;
  const { actor, target: from } = guard;

  const to = await loadTargetUser(toUid);
  if (!to) return jsonError("الموظف المستلم غير موجود", 404);
  if (to.deleted || to.status !== "active") {
    return jsonError("لا يمكن النقل إلى حساب غير نشط", 400);
  }

  const recipientGuard = await guardTargetedRoute(request, toUid, {
    permission: ["users", "manage"],
  });
  if (recipientGuard instanceof NextResponse) return recipientGuard;

  const results = await runTransfer(actor, {
    fromUid,
    fromName: from.name,
    toUid,
    toName:   to.name,
    scopes,
    reason,
  });

  return NextResponse.json({
    success: true,
    transferred: results,
    total: results.reduce((sum, r) => sum + r.moved, 0),
  });
}
