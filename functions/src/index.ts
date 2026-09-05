import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp();
}

/*
 * The monthly-analytics functions are gone: a scheduled recompute, a callable
 * that let any caller rewrite any month's totals, and two triggers that
 * incremented a stored aggregate. The aggregate is not a source of truth and had
 * already drifted from the payments it summarised.
 *
 * Deleting the source does NOT retire what is deployed. Run
 * `firebase deploy --only functions` to remove them from the project.
 */
export { onPaymentCreated } from "./payments";
export { onRefundCreated } from "./refunds";
