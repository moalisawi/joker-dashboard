/**
 * Payment Service
 * Handle all payment-related business logic
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { PaymentTransaction } from "@/types";

export const paymentService = {
  /**
   * Get all payments
   */
  async getAll(): Promise<PaymentTransaction[]> {
    const q = query(collection(db, "payments"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PaymentTransaction[];
  },

  /**
   * Get payments for a subscriber
   */
  async getBySubscriberId(subscriberId: string): Promise<PaymentTransaction[]> {
    const q = query(
      collection(db, "payments"),
      where("subscriberId", "==", subscriberId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PaymentTransaction[];
  },

  /**
   * Get initial payments only
   */
  async getInitialPayments(): Promise<PaymentTransaction[]> {
    const q = query(
      collection(db, "payments"),
      where("isInitialPayment", "==", true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PaymentTransaction[];
  },

  /**
   * Get renewal payments only
   */
  async getRenewalPayments(): Promise<PaymentTransaction[]> {
    const q = query(
      collection(db, "payments"),
      where("isRenewalPayment", "==", true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PaymentTransaction[];
  },

  /**
   * Add payment transaction (immutable)
   */
  async add(payment: Omit<PaymentTransaction, "id">): Promise<string> {
    const docRef = await addDoc(collection(db, "payments"), {
      ...payment,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get payment statistics for a date range
   */
  async getStats(startDate: string, endDate: string) {
    const allPayments = await this.getAll();
    return allPayments.filter(
      (p) => p.date >= startDate && p.date <= endDate
    );
  },
};
