/**
 * Refund Service
 * Handle all refund-related business logic and transactions
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { RefundTransaction, Subscriber } from "@/types";

export const refundService = {
  /**
   * Get all refunds
   */
  async getAll(): Promise<RefundTransaction[]> {
    const q = query(collection(db, "refunds"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as RefundTransaction[];
  },

  /**
   * Get refunds for a subscriber
   */
  async getBySubscriberId(subscriberId: string): Promise<RefundTransaction[]> {
    const q = query(
      collection(db, "refunds"),
      where("subscriberId", "==", subscriberId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as RefundTransaction[];
  },

  /**
   * Add refund transaction (immutable)
   */
  async add(refund: Omit<RefundTransaction, "id">): Promise<string> {
    const docRef = await addDoc(collection(db, "refunds"), {
      ...refund,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Calculate total refund amount for subscriber
   */
  async getTotalRefund(subscriberId: string): Promise<number> {
    const refunds = await this.getBySubscriberId(subscriberId);
    return refunds.reduce((total, r) => total + r.refundAmountUSD, 0);
  },

  /**
   * Process refund with automatic subscriber update
   */
  async processRefund(
    subscriber: Subscriber,
    refundAmountUSD: number,
    reason: string,
    userId: string
  ): Promise<string> {
    // Create refund transaction
    const refundId = await this.add({
      subscriberId: subscriber.id,
      subscriberName: subscriber.name,
      refundAmount: refundAmountUSD,
      refundCurrency: "USD",
      exchangeRate: 1,
      refundAmountUSD,
      refundDate: new Date().toISOString().split("T")[0],
      refundReason: reason,
      createdBy: userId,
    } as any);

    // Update subscriber's net amount
    const newNetAmountUSD = Math.max(
      0,
      subscriber.netAmountUSD - refundAmountUSD
    );

    await updateDoc(doc(db, "subscribers", subscriber.id), {
      netAmountUSD: newNetAmountUSD,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    return refundId;
  },

  /**
   * Get refund statistics for a date range
   */
  async getStats(startDate: string, endDate: string) {
    const allRefunds = await this.getAll();
    return allRefunds.filter(
      (r) => r.refundDate >= startDate && r.refundDate <= endDate
    );
  },

  /**
   * Get total refunded amount in USD for a period
   */
  async getTotalRefundedAmount(startDate: string, endDate: string): Promise<number> {
    const stats = await this.getStats(startDate, endDate);
    return stats.reduce((total, r) => total + r.refundAmountUSD, 0);
  },
};
