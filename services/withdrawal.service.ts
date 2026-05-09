/**
 * Withdrawal Service
 * Handles subscription withdrawal with optional refund.
 * All operations are atomic via Firestore runTransaction.
 * Historical revenue is NEVER modified — refunds are transaction-based.
 */

import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { writeAuditLog } from "@/lib/auditLog";
import type {
  Subscriber,
  WithdrawalData,
  WithdrawalRequest,
  RefundTransaction,
  UserProfile,
} from "@/types";

export const withdrawalService = {
  /** Days elapsed from startDate to today (or toDate). */
  calcDaysUsed(startDate: string, toDate?: string): number {
    const from = new Date(startDate).getTime();
    const to = toDate ? new Date(toDate).getTime() : Date.now();
    return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
  },

  /** Days remaining from today to expiryDate. */
  calcRemainingDays(expiryDate: string, fromDate?: string): number {
    const from = fromDate ? new Date(fromDate).getTime() : Date.now();
    const to = new Date(expiryDate).getTime();
    return Math.max(0, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
  },

  /**
   * Execute a withdrawal operation atomically.
   *
   * What happens:
   *  1. Read and validate subscriber.
   *  2. If refund > 0: create immutable refund doc inside the transaction.
   *  3. Update subscriber: status → withdrawn, save withdrawalData snapshot.
   *  4. After commit: write audit log (non-critical, won't roll back).
   */
  async withdraw(request: WithdrawalRequest): Promise<void> {
    const subscriberRef = doc(db, "subscribers", request.subscriberId);

    // Pre-create a ref for the refund doc so we have the ID before the transaction
    const refundRef = doc(collection(db, "refunds"));
    const refundId = refundRef.id;

    const hasRefund =
      request.refundAmount != null &&
      request.refundAmount > 0 &&
      request.refundAmountUSD != null &&
      request.refundAmountUSD > 0;

    const today = new Date().toISOString().split("T")[0];

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(subscriberRef);
      if (!snap.exists()) throw new Error("المشترك غير موجود");

      const subscriber = { id: snap.id, ...snap.data() } as Subscriber;

      if (subscriber.subscriptionState === "withdrawn") {
        throw new Error("الاشتراك منسحب مسبقاً");
      }

      const activeDaysUsed = this.calcDaysUsed(subscriber.date || subscriber.startDate || today);
      const remainingDays  = this.calcRemainingDays(subscriber.expiryDate, today);

      // Build the refund transaction record
      if (hasRefund) {
        const refundDoc: Omit<RefundTransaction, "id"> = {
          subscriberId:        request.subscriberId,
          subscriberName:      subscriber.name,
          refundAmount:        request.refundAmount!,
          refundCurrency:      request.refundCurrency!,
          exchangeRate:        request.exchangeRate ?? 1,
          refundAmountUSD:     request.refundAmountUSD!,
          refundDate:          today,
          refundReason:        request.reason,
          notes:               request.notes,
          relatedWithdrawalId: refundId,
          isWithdrawalRefund:  true,
          financialImpact:     "negative",
          createdAt:           serverTimestamp() as Timestamp,
          createdBy:           request.performedBy,
          createdByName:       request.performedByName,
        };
        tx.set(refundRef, refundDoc);
      }

      // Build the withdrawal snapshot
      const withdrawalData: WithdrawalData = {
        withdrawnAt:      serverTimestamp() as Timestamp,
        withdrawnBy:      request.performedBy,
        withdrawnByName:  request.performedByName,
        withdrawalReason: request.reason,
        notes:            request.notes,

        refundIssued:    hasRefund,
        refundId:        hasRefund ? refundId : undefined,
        refundAmount:    request.refundAmount,
        refundCurrency:  request.refundCurrency,
        refundAmountUSD: request.refundAmountUSD,
        exchangeRate:    request.exchangeRate,

        originalPlan:        subscriber.package,
        originalExpiryDate:  subscriber.expiryDate,
        previousStatus:      subscriber.status,

        activeDaysUsed,
        remainingDays,
      };

      // Compute updated financial fields
      const previousRefundUSD = subscriber.refundAmountUSD ?? 0;
      const newRefundAmountUSD = hasRefund
        ? previousRefundUSD + request.refundAmountUSD!
        : previousRefundUSD;
      const newNetAmountUSD = Math.max(
        0,
        (subscriber.paidAmountUSD ?? 0) - newRefundAmountUSD
      );

      // Update subscriber atomically
      tx.update(subscriberRef, {
        subscriptionState: "withdrawn",
        status:            "منسحب",
        withdrawalData,
        // Keep legacy fields in sync for backward compatibility
        withdrawalReason:  request.reason,
        withdrawnAt:       today,
        refundAmountUSD:   newRefundAmountUSD,
        netAmountUSD:      newNetAmountUSD,
        updatedAt:         serverTimestamp(),
        updatedBy:         request.performedBy,
      });
    });

    // Audit log — written after commit (non-atomic by design)
    const actor: UserProfile = {
      uid:    request.performedBy,
      name:   request.performedByName,
      email:  "",
      role:   "employee",
      active: true,
    };

    await writeAuditLog(actor, "subscriber_withdrawn", {
      targetType: "subscriber",
      targetId:   request.subscriberId,
      summary:    `تم تسجيل انسحاب المشترك`,
      metadata: {
        reason:          request.reason,
        refundIssued:    hasRefund,
        refundAmountUSD: request.refundAmountUSD ?? 0,
        refundId:        hasRefund ? refundId : null,
      },
    });

    if (hasRefund) {
      await writeAuditLog(actor, "refund_created", {
        targetType: "refund",
        targetId:   refundId,
        summary:    `تم إنشاء استرداد بمبلغ $${(request.refundAmountUSD ?? 0).toFixed(2)}`,
        metadata: {
          subscriberId:    request.subscriberId,
          refundAmountUSD: request.refundAmountUSD,
          refundCurrency:  request.refundCurrency,
          reason:          request.reason,
        },
      });
    }
  },
};
