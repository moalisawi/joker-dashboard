/**
 * Subscriber Service
 * Handle all subscriber-related business logic
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { Subscriber } from "@/types";

export const subscriberService = {
  /**
   * Get all subscribers
   */
  async getAll(): Promise<Subscriber[]> {
    const q = query(collection(db, "subscribers"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscriber[];
  },

  /**
   * Get subscriber by ID
   */
  async getById(id: string): Promise<Subscriber | null> {
    const docRef = doc(db, "subscribers", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists()
      ? ({ id: docSnap.id, ...docSnap.data() } as Subscriber)
      : null;
  },

  /**
   * Get active subscribers
   */
  async getActive(): Promise<Subscriber[]> {
    const q = query(
      collection(db, "subscribers"),
      where("subscriptionState", "==", "active")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscriber[];
  },

  /**
   * Get withdrawn subscribers
   */
  async getWithdrawn(): Promise<Subscriber[]> {
    const q = query(
      collection(db, "subscribers"),
      where("subscriptionState", "==", "withdrawn")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscriber[];
  },

  /**
   * Update subscriber
   */
  async update(id: string, data: Partial<Subscriber>): Promise<void> {
    await callSubscriberOperation("updateSubscriber", {
      subscriberId: id,
      subscriber: data,
    });
  },

  /**
   * Delete subscriber
   */
  async delete(id: string): Promise<void> {
    await callSubscriberOperation("deleteSubscriber", {
      subscriberId: id,
    });
  },

  /**
   * Search subscribers by name or phone
   */
  async search(term: string): Promise<Subscriber[]> {
    const allSubscribers = await this.getAll();
    return allSubscribers.filter(
      (s) =>
        s.name.toLowerCase().includes(term.toLowerCase()) ||
        s.phone.includes(term)
    );
  },
};
