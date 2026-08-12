import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { verifyServerUser, hasServerPermission } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { writeUserAudit } from "@/lib/serverAudit";
import { COLLECTIONS } from "@/constants/collections";
import { SETTLEMENT_BATCHES } from "@/lib/serverBillingLedger";

export const runtime = "nodejs";

/**
 * Reconciling a payment method against what actually landed.
 *
 * The system records what it was *told* was paid. The bank or wallet knows what
 * actually settled, and the two disagree — a transfer that bounced, a fee taken
 * at the far end, a payment recorded twice. Until now nothing in the product
 * could express that gap, so it was found (or not) in a spreadsheet.
 *
 * A batch is a claim about one method over one period: here is what we expected,
 * here is what the statement says, here is the difference. Every payment inside
 * it is stamped `reconciled` and pointed at the batch, so a payment can never be
 * silently counted in two batches — the query that builds the next batch skips
 * anything already stamped.
 *
 * `preview` returns the same figures without writing, because a reconciliation
 * you cannot inspect before committing is one you will commit wrong.
 */

const bodySchema = z.object({
  paymentMethodId:   z.string().min(1).max(128),
  paymentMethodName: z.string().max(200).optional(),
  periodStart:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** What the statement says actually landed, in the method's own currency. */
  actualTotalOriginal: z.number().optional(),
  actualTotalUSD:      z.number().optional(),
  notes:  z.string().max(2000).optional().nullable(),
  /** true = compute and return, write nothing. */
  preview: z.boolean().optional(),
}).refine((v) => v.periodStart <= v.periodEnd, {
  message: "تاريخ البداية بعد تاريخ النهاية",
  path: ["periodEnd"],
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Firestore caps a batch at 500 writes; each payment stamp costs one. */
const WRITE_CHUNK = 400;

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`reconcile:${ip}`, 20, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let actor;
  try { actor = await verifyServerUser(request); } catch { return jsonError("Unauthorized", 401); }
  if (!actor) return jsonError("Unauthorized", 401);

  if (!hasAdminCredentials()) {
    return jsonError("Admin credentials غير مفعّلة على السيرفر", 503);
  }

  // Reconciliation is a finance-desk action: it declares that money did or did
  // not arrive. payments.edit is the same bar receipt verification uses.
  if (!hasServerPermission(actor, "payments", "edit")) return jsonError("Forbidden", 403);

  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Invalid JSON", 400); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Validation error", 422);

  const {
    paymentMethodId, paymentMethodName, periodStart, periodEnd,
    actualTotalOriginal, actualTotalUSD, notes, preview,
  } = parsed.data;

  const db = getFirestore();

  // Payments in the window for this method. `date` is a YYYY-MM-DD string, so
  // range comparison is lexicographic and correct without a composite index
  // beyond the (paymentMethodId, date) pair already declared.
  const snap = await db.collection(COLLECTIONS.PAYMENTS)
    .where("paymentMethodId", "==", paymentMethodId)
    .where("date", ">=", periodStart)
    .where("date", "<=", periodEnd)
    .get();

  // Already-reconciled payments are excluded rather than re-counted. Without
  // this, re-running a period would double the expected total and manufacture a
  // discrepancy that does not exist.
  type PaymentRow = { id: string; amountUSD?: number; settlementStatus?: string };
  const rows: PaymentRow[] = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRow, "id">) }))
    .filter((p) => (p.settlementStatus ?? "unreconciled") === "unreconciled");

  const expectedTotalUSD = rows.reduce((sum, p) => sum + (Number(p.amountUSD) || 0), 0);
  const actualUSD = actualTotalUSD ?? expectedTotalUSD;
  const differenceUSD = actualUSD - expectedTotalUSD;

  const summary = {
    paymentCount: rows.length,
    expectedTotalUSD,
    actualTotalUSD: actualUSD,
    differenceUSD,
    alreadyReconciled: snap.size - rows.length,
  };

  if (preview) {
    return NextResponse.json({ success: true, preview: true, ...summary });
  }

  if (rows.length === 0) {
    return jsonError("لا توجد دفعات غير مطابَقة في هذه الفترة", 400);
  }

  const batchRef = db.collection(SETTLEMENT_BATCHES).doc();
  // A non-zero difference is not an error — it is the finding the batch exists
  // to record — but it is flagged so it cannot be closed by accident.
  const status = Math.abs(differenceUSD) < 0.01 ? "reconciled" : "disputed";

  await batchRef.set({
    paymentMethodId,
    paymentMethodName: paymentMethodName ?? paymentMethodId,
    periodStart,
    periodEnd,
    expectedTotalUSD,
    actualTotalOriginal: actualTotalOriginal ?? null,
    actualTotalUSD: actualUSD,
    differenceUSD,
    status,
    paymentIds: rows.map((p) => p.id),
    notes: notes ?? null,
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const batch = db.batch();
    for (const p of rows.slice(i, i + WRITE_CHUNK)) {
      batch.update(db.collection(COLLECTIONS.PAYMENTS).doc(p.id), {
        settlementStatus:  status === "reconciled" ? "reconciled" : "disputed",
        settlementBatchId: batchRef.id,
        reconciledAt:      FieldValue.serverTimestamp(),
        reconciledBy:      actor.uid,
      });
    }
    await batch.commit();
  }

  await writeUserAudit(actor, {
    action:     "payments_reconciled",
    severity:   status === "reconciled" ? "info" : "warning",
    targetUid:  batchRef.id,
    targetName: paymentMethodName ?? paymentMethodId,
    description:
      `مطابقة ${rows.length} دفعة عبر ${paymentMethodName ?? paymentMethodId} ` +
      `(${periodStart} → ${periodEnd}) — الفرق $${differenceUSD.toFixed(2)}`,
    metadata: { paymentMethodId, periodStart, periodEnd, ...summary, status },
    tags: ["financial", "reconciliation"],
  });

  return NextResponse.json({ success: true, batchId: batchRef.id, status, ...summary });
}
