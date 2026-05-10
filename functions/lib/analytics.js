"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeMonthlyAnalytics = exports.computeMonthlyAnalyticsScheduled = void 0;
const admin = require("firebase-admin");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const PAGE_SIZE = 500;
function emptyEntry() {
    return {
        totalPaymentsUSD: 0,
        totalRefundsUSD: 0,
        netRevenueUSD: 0,
        paymentCount: 0,
        refundCount: 0,
        withdrawalCount: 0,
    };
}
function accumulate(map, key, delta) {
    if (!map[key])
        map[key] = emptyEntry();
    const e = map[key];
    e.totalPaymentsUSD += delta.totalPaymentsUSD ?? 0;
    e.totalRefundsUSD += delta.totalRefundsUSD ?? 0;
    e.paymentCount += delta.paymentCount ?? 0;
    e.refundCount += delta.refundCount ?? 0;
    e.withdrawalCount += delta.withdrawalCount ?? 0;
}
function finalizeBreakdown(map) {
    for (const e of Object.values(map)) {
        e.netRevenueUSD = e.totalPaymentsUSD - e.totalRefundsUSD;
    }
}
async function computeMonthlyAnalytics(targetMonth) {
    const db = admin.firestore();
    const [year, month] = targetMonth.split("-").map(Number);
    const monthStart = `${targetMonth}-01`;
    // Next month boundary as YYYY-MM-DD string
    const nextMonthDate = month === 12
        ? new Date(year + 1, 0, 1)
        : new Date(year, month, 1);
    const nextMonth = nextMonthDate.toISOString().slice(0, 10);
    const byEmployee = {};
    const byPackage = {};
    const byCountry = {};
    // ── Payments ──────────────────────────────────────────────────────────────
    let totalPaymentsUSD = 0;
    let paymentCount = 0;
    const paymentsSnap = await db.collection("payments")
        .where("date", ">=", monthStart)
        .where("date", "<", nextMonth)
        .get();
    const subscriberIds = new Set();
    for (const doc of paymentsSnap.docs) {
        const p = doc.data();
        const amt = p.amountUSD ?? 0;
        totalPaymentsUSD += amt;
        paymentCount++;
        if (p.createdBy)
            accumulate(byEmployee, p.createdBy, { totalPaymentsUSD: amt, paymentCount: 1 });
        if (p.subscriberId)
            subscriberIds.add(p.subscriberId);
    }
    // Fetch subscriber metadata (package + residence) for byPackage / byCountry breakdowns
    const subMeta = {};
    const ids = [...subscriberIds];
    for (let i = 0; i < ids.length; i += 30) {
        const snap = await db.collection("subscribers")
            .where(admin.firestore.FieldPath.documentId(), "in", ids.slice(i, i + 30))
            .get();
        for (const doc of snap.docs) {
            const s = doc.data();
            subMeta[doc.id] = {
                pkg: s.package ?? "unknown",
                country: s.residence ?? "unknown",
            };
        }
    }
    for (const doc of paymentsSnap.docs) {
        const p = doc.data();
        const amt = p.amountUSD ?? 0;
        const meta = subMeta[p.subscriberId];
        if (meta) {
            accumulate(byPackage, meta.pkg, { totalPaymentsUSD: amt, paymentCount: 1 });
            accumulate(byCountry, meta.country, { totalPaymentsUSD: amt, paymentCount: 1 });
        }
    }
    // ── Refunds ───────────────────────────────────────────────────────────────
    let totalRefundsUSD = 0;
    let refundCount = 0;
    const refundsSnap = await db.collection("refunds")
        .where("refundDate", ">=", monthStart)
        .where("refundDate", "<", nextMonth)
        .get();
    for (const doc of refundsSnap.docs) {
        const r = doc.data();
        const amt = r.refundAmountUSD ?? 0;
        totalRefundsUSD += amt;
        refundCount++;
        if (r.createdBy)
            accumulate(byEmployee, r.createdBy, { totalRefundsUSD: amt, refundCount: 1 });
        const meta = subMeta[r.subscriberId];
        if (meta) {
            accumulate(byPackage, meta.pkg, { totalRefundsUSD: amt, refundCount: 1 });
            accumulate(byCountry, meta.country, { totalRefundsUSD: amt, refundCount: 1 });
        }
    }
    // ── Withdrawals — paginated scan ──────────────────────────────────────────
    // Bug fix: filter by the withdrawal date falling in targetMonth,
    // not by current subscriptionState alone (would double-count old withdrawals).
    let withdrawalCount = 0;
    let cursor = null;
    do {
        let q = db.collection("subscribers")
            .where("subscriptionState", "==", "withdrawn")
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE);
        if (cursor)
            q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty)
            break;
        for (const doc of snap.docs) {
            const s = doc.data();
            // Resolve withdrawal date: new string field first, then legacy Timestamp
            let withdrawnOn = null;
            if (typeof s.withdrawnAt === "string") {
                withdrawnOn = s.withdrawnAt.slice(0, 10);
            }
            else if (s.withdrawalDate?.toDate) {
                withdrawnOn = s.withdrawalDate.toDate().toISOString().slice(0, 10);
            }
            if (withdrawnOn && withdrawnOn >= monthStart && withdrawnOn < nextMonth) {
                withdrawalCount++;
                const emp = s.convincedBy ?? "unknown";
                const pkg = s.package ?? "unknown";
                const country = s.residence ?? "unknown";
                accumulate(byEmployee, emp, { withdrawalCount: 1 });
                accumulate(byPackage, pkg, { withdrawalCount: 1 });
                accumulate(byCountry, country, { withdrawalCount: 1 });
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
    v2_1.logger.info(`[analytics] ${targetMonth}: ${paymentCount} payments, ${refundCount} refunds, ${withdrawalCount} withdrawals`);
}
// Runs at 01:00 UTC on the 1st of every month — computes the previous month
exports.computeMonthlyAnalyticsScheduled = (0, scheduler_1.onSchedule)("0 1 1 * *", async () => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const target = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    await computeMonthlyAnalytics(target);
});
// Callable — manual recompute from admin UI (pass { month: "YYYY-MM" })
exports.recomputeMonthlyAnalytics = (0, https_1.onCall)({ enforceAppCheck: false }, async (req) => {
    const month = req.data?.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        throw new Error("Expected { month: 'YYYY-MM' }.");
    }
    await computeMonthlyAnalytics(month);
    return { success: true, month };
});
//# sourceMappingURL=analytics.js.map