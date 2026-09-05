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
/**
 * Flag a refund recorded by an account that is no longer active.
 *
 * The `monthlyAnalytics` decrement this used to perform is gone with the
 * aggregate itself; see the note in payments.ts. Refund totals are computed
 * from the `refunds` collection at read time.
 */
exports.onRefundCreated = (0, firestore_1.onDocumentCreated)("refunds/{refundId}", async (event) => {
    const refund = event.data?.data();
    if (!refund)
        return;
    const createdBy = refund["createdBy"];
    if (!createdBy)
        return;
    const userSnap = await admin.firestore().collection("users").doc(createdBy).get();
    if (userSnap.exists && !isUserActive(userSnap.data())) {
        v2_1.logger.warn("[refunds] Refund created by inactive user:", createdBy, event.params.refundId);
    }
});
//# sourceMappingURL=refunds.js.map