/**
 * Refund Service
 * Handle all refund-related business logic and transactions
 */

import {
  collection,
  query,
  where,
  getDocs,
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
    void refund;
    throw new Error("Refunds must be created through protected subscriber operations.");
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
    void subscriber;
    void refundAmountUSD;
    void reason;
    void userId;
    throw new Error("Standalone refunds are disabled. Use the protected withdrawal flow.");
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
