import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

import { verifyServerUser } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  PERIOD_PATTERN,
  applyPeriodAction,
  refusePeriodAction,
  type FinancialPeriod,
  type PeriodSnapshot,
} from "@/lib/financialPeriod";
import { PERIODS, readPeriod } from "@/lib/serverFinancialPeriod";
import { recognizedInPeriod, deferredAsOf } from "@/lib/revenueRecognition";

export const runtime = "nodejs";

/**
 * Closing and reopening a month.
 *
 * A period is a permission, not a report: closing says "no more money may be
 * dated into May", and every financial figure stays computed from payments,
 * refunds, adjustments, cycles and invoices exactly as before. Nothing here
 * creates a stored aggregate — the one that used to exist had drifted from the
 * payments it summarised and was removed rather than repaired.
 *
 * Owner only, in both directions. An admin who could close could end the review
 * of their own month; an admin who could reopen could undo the close that
 * stopped them.
 */

const bodySchema = z.object({
  action: z.enum(["close", "reopen"]),
  period: z.string().regex(PERIOD_PATTERN, "الفترة يجب أن تكون بصيغة YYYY-MM"),
  reason: z.string().max(1000),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function lastDayOf(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * What the month reported, computed from the source documents at this moment.
 *
 * Taken at close because recognised revenue is derived from contracts that can
 * still be corrected afterwards — without a record of what was reported, a
 * later correction would rewrite the past with nothing to compare against.
 * It is a record, never an authority: §13.
 */
async function takeSnapshot(period: string): Promise<PeriodSnapshot> {
  const db = getFirestore();
  const from = `${period}-01`;
  const to = lastDayOf(period);

  const [paySnap, refSnap, subSnap] = await Promise.all([
    db.collection("payments").where("date", ">=", from).where("date", "<=", to).get(),
    db.collection("refunds").where("refundDate", ">=", from).where("refundDate", "<=", to).get(),
    db.collection("subscribers").get(),
  ]);

  const cashUSD = paySnap.docs.reduce((sum, d) => sum + (Number(d.data().amountUSD) || 0), 0);
  const refundsUSD = refSnap.docs.reduce((sum, d) => sum + (Number(d.data().refundAmountUSD) || 0), 0);

  // Deleted subscribers are excluded the way every other aggregate excludes
  // them: soft delete is the only delete here, and a reader that forgets it
  // invents revenue.
  const subs = subSnap.docs
    .map((d) => d.data())
    .filter((s) => s.deleted !== true)
    .map((s) => ({
      date: s.date as string | undefined,
      startDate: s.startDate as string | undefined,
      duration: Number(s.duration) || 0,
      totalPriceUSD: Number(s.totalPriceUSD) || 0,
      paidAmountUSD: Number(s.paidAmountUSD) || 0,
    }));

  const recognizedRevenueUSD = subs.reduce((sum, s) => sum + recognizedInPeriod(s, from, to), 0);
  const deferredRevenueUSD = subs.reduce((sum, s) => sum + deferredAsOf(s, to), 0);

  return {
    cashUSD: Math.round(cashUSD * 100) / 100,
    refundsUSD: Math.round(refundsUSD * 100) / 100,
    recognizedRevenueUSD: Math.round(recognizedRevenueUSD * 100) / 100,
    deferredRevenueUSD: Math.round(deferredRevenueUSD * 100) / 100,
    takenAt: new Date().toISOString(),
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`fin-periods:${ip}`, 30, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let user;
  try {
    user = await verifyServerUser(request);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!user) return jsonError("Unauthorized", 401);
  if (!hasAdminCredentials()) {
    return jsonError("Admin credentials غير مفعّلة على السيرفر", 503);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);
  }
  const { action, period, reason } = parsed.data;

  const current = await readPeriod(period);
  const refusals = refusePeriodAction(action, period, reason, current, user.role, todayString());
  if (refusals.length > 0) {
    // 403 when the only problem is who is asking; 422 when it is what they ask.
    const roleOnly = refusals.every((r) => r.field === "role");
    return jsonError(refusals.map((r) => r.message).join(" · "), roleOnly ? 403 : 422);
  }

  const snapshot = action === "close" ? await takeSnapshot(period) : undefined;
  const next: FinancialPeriod = applyPeriodAction(
    action,
    period,
    reason,
    current,
    { uid: user.uid, name: user.email ?? user.uid },
    new Date().toISOString(),
    snapshot
  );

  const db = getFirestore();
  await db.collection(PERIODS).doc(period).set(next);

  await db.collection("auditLogs").add({
    action: action === "close" ? "financial_period_closed" : "financial_period_reopened",
    category: "financial",
    // Reopening is the exceptional act — it says a closed month was wrong.
    severity: action === "close" ? "info" : "warning",
    source: "server",
    entityType: "financialPeriod",
    entityId: period,
    entityName: period,
    description:
      action === "close"
        ? `إغلاق الفترة ${period} — ${reason.trim()}`
        : `إعادة فتح الفترة ${period} — ${reason.trim()}`,
    previousData: current ? { status: current.status } : { status: "open" },
    newData: { status: next.status, snapshot: next.snapshot ?? null },
    changedFields: ["status"],
    performedBy: { uid: user.uid, name: user.email ?? user.uid, email: user.email ?? "", role: user.role },
    metadata: { period, reason: reason.trim(), eventCount: next.events.length },
    tags: ["financial-period"],
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, period: next });
}

/** The closed months, so a screen can say why a date is refused before it is. */
export async function GET(request: Request): Promise<NextResponse> {
  let user;
  try {
    user = await verifyServerUser(request);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!user) return jsonError("Unauthorized", 401);

  const snap = await getFirestore().collection(PERIODS).orderBy("period", "desc").limit(60).get();
  return NextResponse.json({
    success: true,
    periods: snap.docs.map((d) => ({ period: d.id, ...d.data() })),
  });
}
