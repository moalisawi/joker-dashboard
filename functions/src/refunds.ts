import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

// Bug fix: check structured status field first, fall back to legacy active boolean
function isUserActive(user: admin.firestore.DocumentData): boolean {
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
export const onRefundCreated = onDocumentCreated("refunds/{refundId}", async (event) => {
  const refund = event.data?.data();
  if (!refund) return;

  const createdBy = refund["createdBy"] as string | undefined;
  if (!createdBy) return;

  const userSnap = await admin.firestore().collection("users").doc(createdBy).get();
  if (userSnap.exists && !isUserActive(userSnap.data()!)) {
    logger.warn("[refunds] Refund created by inactive user:", createdBy, event.params.refundId);
  }
});
