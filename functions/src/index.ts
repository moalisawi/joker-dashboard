import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp();
}

export { computeMonthlyAnalyticsScheduled, recomputeMonthlyAnalytics } from "./analytics";
export { onPaymentCreated } from "./payments";
export { onRefundCreated } from "./refunds";
