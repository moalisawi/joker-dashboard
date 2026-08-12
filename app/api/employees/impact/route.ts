import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { guardTargetedRoute, jsonError } from "@/lib/employeeAdminGuard";
import { buildImpactSummary } from "@/lib/userImpact";

export const runtime = "nodejs";

const schema = z.object({ uid: z.string().min(1) });

/**
 * What would break if this account were disabled or archived.
 *
 * Read-only, and deliberately its own endpoint rather than a flag on the
 * destructive routes: the confirmation dialog has to show these numbers
 * *before* anyone commits, and a preview that runs inside the mutation is not a
 * preview.
 *
 * Gated on users.activateAccounts — the same permission the deactivate route
 * requires — so nobody can enumerate another employee's book of business
 * without also being able to act on that account.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`emp-impact:${ip}`, 60, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const guard = await guardTargetedRoute(request, parsed.data.uid, {
    permission: ["users", "activateAccounts"],
  });
  if (guard instanceof NextResponse) return guard;

  const impact = await buildImpactSummary(guard.target.uid);

  return NextResponse.json({
    success: true,
    impact,
    target: {
      uid:    guard.target.uid,
      name:   guard.target.name,
      status: guard.target.status,
      role:   guard.target.role,
    },
  });
}
