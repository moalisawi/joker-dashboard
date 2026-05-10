import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

const PAGE_SIZE = 500;

interface BreakdownEntry {
  totalPaymentsUSD: number;
  totalRefundsUSD: number;
  netRevenueUSD: number;
  paymentCount: number;
  refundCount: number;
  withdrawalCount: number;
}

type Breakdown = Record<string, BreakdownEntry>;

function emptyEntry(): BreakdownEntry {
  return {
    totalPaymentsUSD: 0,
    totalRefundsUSD: 0,
    netRevenueUSD: 0,
    paymentCount: 0,
    refundCount: 0,
    withdrawalCount: 0,
  };
}

function accumulate(
  map: Breakdown,
  key: string,
  delta: Partial<Omit<BreakdownEntry, "netRevenueUSD">>
) {
  if (!map[key]) map[key] = emptyEntry();
  const e = map[key];
  e.totalPaymentsUSD += delta.totalPaymentsUSD ?? 0;
  e.totalRefundsUSD  += delta.totalRefundsUSD  ?? 0;
  e.paymentCount     += delta.paymentCount     ?? 0;
  e.refundCount      += delta.refundCount      ?? 0;
  e.withdrawalCount  += delta.withdrawalCount  ?? 0;
}

function finalizeBreakdown(map: Breakdown) {
  for (const e of Object.values(map)) {
    e.netRevenueUSD = e.totalPaymentsUSD - e.totalRefundsUSD;
  }
}

async function computeMonthlyAnalytics(targetMonth: string): Promise<void> {
  const db = admin.firestore();
  const [year, month] = targetMonth.split("-").map(Number);
  const monthStart = `${targetMonth}-01`;

  // Next month boundary as YYYY-MM-DD string
  const nextMonthDate = month === 12
    ? new Date(year + 1, 0, 1)
    : new Date(year, month, 1);
  const nextMonth = nextMonthDate.toISOString().slice(0, 10);

  const byEmployee: Breakdown = {};
  const byPackage: Breakdown  = {};
  const byCountry: Breakdown  = {};

  // ── Payments ──────────────────────────────────────────────────────────────
  let totalPaymentsUSD = 0;
  let paymentCount     = 0;

  const paymentsSnap = await db.collection("payments")
    .where("date", ">=", monthStart)
    .where("date", "<",  nextMonth)
    .get();

  const subscriberIds = new Set<string>();
  for (const doc of paymentsSnap.docs) {
    const p   = doc.data();
    const amt = (p.amountUSD as number) ?? 0;
    totalPaymentsUSD += amt;
    paymentCount++;
    if (p.createdBy)    accumulate(byEmployee, p.createdBy as string, { totalPaymentsUSD: amt, paymentCount: 1 });
    if (p.subscriberId) subscriberIds.add(p.subscriberId as string);
  }

  // Fetch subscriber metadata (package + residence) for byPackage / byCountry breakdowns
  const subMeta: Record<string, { pkg: string; country: string }> = {};
  const ids = [...subscriberIds];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db.collection("subscribers")
      .where(admin.firestore.FieldPath.documentId(), "in", ids.slice(i, i + 30))
      .get();
    for (const doc of snap.docs) {
      const s = doc.data();
      subMeta[doc.id] = {
        pkg:     (s.package   as string) ?? "unknown",
        country: (s.residence as string) ?? "unknown",
      };
    }
  }

  for (const doc of paymentsSnap.docs) {
    const p    = doc.data();
    const amt  = (p.amountUSD as number) ?? 0;
    const meta = subMeta[p.subscriberId as string];
    if (meta) {
      accumulate(byPackage, meta.pkg,     { totalPaymentsUSD: amt, paymentCount: 1 });
      accumulate(byCountry, meta.country, { totalPaymentsUSD: amt, paymentCount: 1 });
    }
  }

  // ── Refunds ───────────────────────────────────────────────────────────────
  let totalRefundsUSD = 0;
  let refundCount     = 0;

  const refundsSnap = await db.collection("refunds")
    .where("refundDate", ">=", monthStart)
    .where("refundDate", "<",  nextMonth)
    .get();

  for (const doc of refundsSnap.docs) {
    const r   = doc.data();
    const amt = (r.refundAmountUSD as number) ?? 0;
    totalRefundsUSD += amt;
    refundCount++;
    if (r.createdBy) accumulate(byEmployee, r.createdBy as string, { totalRefundsUSD: amt, refundCount: 1 });

    const meta = subMeta[r.subscriberId as string];
    if (meta) {
      accumulate(byPackage, meta.pkg,     { totalRefundsUSD: amt, refundCount: 1 });
      accumulate(byCountry, meta.country, { totalRefundsUSD: amt, refundCount: 1 });
    }
  }

  // ── Withdrawals — paginated scan ──────────────────────────────────────────
  // Bug fix: filter by the withdrawal date falling in targetMonth,
  // not by current subscriptionState alone (would double-count old withdrawals).
  let withdrawalCount = 0;
  let cursor: admin.firestore.QueryDocumentSnapshot | null = null;

  do {
    let q = db.collection("subscribers")
      .where("subscriptionState", "==", "withdrawn")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const s = doc.data();

      // Resolve withdrawal date: new string field first, then legacy Timestamp
      let withdrawnOn: string | null = null;
      if (typeof s.withdrawnAt === "string") {
        withdrawnOn = s.withdrawnAt.slice(0, 10);
      } else if (s.withdrawalDate?.toDate) {
        withdrawnOn = (s.withdrawalDate.toDate() as Date).toISOString().slice(0, 10);
      }

      if (withdrawnOn && withdrawnOn >= monthStart && withdrawnOn < nextMonth) {
        withdrawalCount++;
        const emp     = (s.convincedBy  as string) ?? "unknown";
        const pkg     = (s.package      as string) ?? "unknown";
        const country = (s.residence    as string) ?? "unknown";
        accumulate(byEmployee, emp,     { withdrawalCount: 1 });
        accumulate(byPackage,  pkg,     { withdrawalCount: 1 });
        accumulate(byCountry,  country, { withdrawalCount: 1 });
      }
    }

    cursor = snap.size < PAGE_SIZE ? null : snap.docs[snap.docs.length - 1];
  } while (cursor !== null);

  finalizeBreakdown(byEmployee);
  finalizeBreakdown(byPackage);
  finalizeBreakdown(byCountry);

  await db.collection("monthlyAnalytics").doc(targetMonth).set({
    month: targetMonth,
    totalPaymentsUSD,
    totalRefundsUSD,
    netRevenueUSD: totalPaymentsUSD - totalRefundsUSD,
    paymentCount,
    refundCount,
    withdrawalCount,
    byEmployee,
    byPackage,
    byCountry,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: "system",
  });

  logger.info(
    `[analytics] ${targetMonth}: ${paymentCount} payments, ${refundCount} refunds, ${withdrawalCount} withdrawals`
  );
}

// Runs at 01:00 UTC on the 1st of every month — computes the previous month
export const computeMonthlyAnalyticsScheduled = onSchedule("0 1 1 * *", async () => {
  const now  = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const target = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  await computeMonthlyAnalytics(target);
});

// Callable — manual recompute from admin UI (pass { month: "YYYY-MM" })
export const recomputeMonthlyAnalytics = onCall({ enforceAppCheck: false }, async (req) => {
  const month = req.data?.month as string | undefined;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Expected { month: 'YYYY-MM' }.");
  }
  await computeMonthlyAnalytics(month);
  return { success: true, month };
});
