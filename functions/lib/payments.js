"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPaymentCreated = void 0;
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
exports.onPaymentCreated = (0, firestore_1.onDocumentCreated)("payments/{paymentId}", async (event) => {
    const payment = event.data?.data();
    if (!payment)
        return;
    const db = admin.firestore();
    const month = payment["date"]?.slice(0, 7);
    const createdBy = payment["createdBy"];
    if (!month) {
        v2_1.logger.error("[payments] Missing date on payment", event.params.paymentId);
        return;
    }
    // Warn if the creator's account is not active
    if (createdBy) {
        const userSnap = await db.collection("users").doc(createdBy).get();
        if (userSnap.exists && !isUserActive(userSnap.data())) {
            v2_1.logger.warn("[payments] Payment created by inactive user:", createdBy);
        }
    }
    // Incrementally update monthly analytics document
    const ref = db.collection("monthlyAnalytics").doc(month);
    const amt = payment["amountUSD"] ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delta = {
        totalPaymentsUSD: admin.firestore.FieldValue.increment(amt),
        netRevenueUSD: admin.firestore.FieldValue.increment(amt),
        paymentCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (createdBy) {
        delta[`byEmployee.${createdBy}.totalPaymentsUSD`] = admin.firestore.FieldValue.increment(amt);
        delta[`byEmployee.${createdBy}.netRevenueUSD`] = admin.firestore.FieldValue.increment(amt);
        delta[`byEmployee.${createdBy}.paymentCount`] = admin.firestore.FieldValue.increment(1);
    }
    await ref.set(delta, { merge: true });
    v2_1.logger.info(`[payments] Updated monthlyAnalytics/${month} +$${amt}`);
});
//# sourceMappingURL=payments.js.map