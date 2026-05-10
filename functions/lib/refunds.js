"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRefundCreated = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
// Bug fix: check structured status field first, fall back to legacy active boolean
function isUserActive(user) {
    if (typeof user["status"] === "string") {
        return user["status"] === "active";
    }
    return user["active"] === true;
}
exports.onRefundCreated = (0, firestore_1.onDocumentCreated)("refunds/{refundId}", async (event) => {
    const refund = event.data?.data();
    if (!refund)
        return;
    const db = admin.firestore();
    const month = refund["refundDate"]?.slice(0, 7);
    const createdBy = refund["createdBy"];
    if (!month) {
        v2_1.logger.error("[refunds] Missing refundDate on refund", event.params.refundId);
        return;
    }
    // Warn if the creator's account is not active
    if (createdBy) {
        const userSnap = await db.collection("users").doc(createdBy).get();
        if (userSnap.exists && !isUserActive(userSnap.data())) {
            v2_1.logger.warn("[refunds] Refund created by inactive user:", createdBy);
        }
    }
    // Incrementally update monthly analytics document
    const ref = db.collection("monthlyAnalytics").doc(month);
    const amt = refund["refundAmountUSD"] ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delta = {
        totalRefundsUSD: admin.firestore.FieldValue.increment(amt),
        netRevenueUSD: admin.firestore.FieldValue.increment(-amt),
        refundCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (createdBy) {
        delta[`byEmployee.${createdBy}.totalRefundsUSD`] = admin.firestore.FieldValue.increment(amt);
        delta[`byEmployee.${createdBy}.netRevenueUSD`] = admin.firestore.FieldValue.increment(-amt);
        delta[`byEmployee.${createdBy}.refundCount`] = admin.firestore.FieldValue.increment(1);
    }
    await ref.set(delta, { merge: true });
    v2_1.logger.info(`[refunds] Updated monthlyAnalytics/${month} -$${amt}`);
});
//# sourceMappingURL=refunds.js.map