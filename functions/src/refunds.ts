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

export const onRefundCreated = onDocumentCreated("refunds/{refundId}", async (event) => {
  const refund = event.data?.data();
  if (!refund) return;

  const db        = admin.firestore();
  const month     = (refund["refundDate"] as string | undefined)?.slice(0, 7);
  const createdBy = refund["createdBy"] as string | undefined;

  if (!month) {
    logger.error("[refunds] Missing refundDate on refund", event.params.refundId);
    return;
  }

  // Warn if the creator's account is not active
  if (createdBy) {
    const userSnap = await db.collection("users").doc(createdBy).get();
    if (userSnap.exists && !isUserActive(userSnap.data()!)) {
      logger.warn("[refunds] Refund created by inactive user:", createdBy);
    }
  }

  // Incrementally update monthly analytics document
  const ref = db.collection("monthlyAnalytics").doc(month);
  const amt = (refund["refundAmountUSD"] as number) ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delta: Record<string, any> = {
    totalRefundsUSD: admin.firestore.FieldValue.increment(amt),
    netRevenueUSD:   admin.firestore.FieldValue.increment(-amt),
    refundCount:     admin.firestore.FieldValue.increment(1),
    updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
  };

  if (createdBy) {
    delta[`byEmployee.${createdBy}.totalRefundsUSD`] = admin.firestore.FieldValue.increment(amt);
    delta[`byEmployee.${createdBy}.netRevenueUSD`]   = admin.firestore.FieldValue.increment(-amt);
    delta[`byEmployee.${createdBy}.refundCount`]     = admin.firestore.FieldValue.increment(1);
  }

  await ref.set(delta, { merge: true });
  logger.info(`[refunds] Updated monthlyAnalytics/${month} -$${amt}`);
});
