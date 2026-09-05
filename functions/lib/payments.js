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
/**
 * Flag a payment recorded by an account that is no longer active.
 *
 * This trigger used to do a second job: increment `monthlyAnalytics/{month}`
 * with the payment's amount. That aggregate has been removed. It was a second
 * copy of a number the payments themselves already hold, and it had drifted —
 * `monthlyAnalytics/2026-05` claimed 12 payments totalling $900 against 13
 * totalling $2,021 in the collection. It also had no notion of a closed period,
 * so a payment recorded today and dated to May silently moved May's totals
 * months after the fact.
 *
 * Every financial figure is now computed from `payments`, `refunds` and
 * `paymentAdjustments` at read time. There is no stored aggregate left to drift.
 *
 * What remains is the warning below, which writes nothing and only logs.
 */
exports.onPaymentCreated = (0, firestore_1.onDocumentCreated)("payments/{paymentId}", async (event) => {
    const payment = event.data?.data();
    if (!payment)
        return;
    const createdBy = payment["createdBy"];
    if (!createdBy)
        return;
    const userSnap = await admin.firestore().collection("users").doc(createdBy).get();
    if (userSnap.exists && !isUserActive(userSnap.data())) {
        v2_1.logger.warn("[payments] Payment created by inactive user:", createdBy, event.params.paymentId);
    }
});
//# sourceMappingURL=payments.js.map