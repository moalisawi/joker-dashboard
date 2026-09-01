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

const SUBS = "subscribers";

// Client-side guard: excludes soft-deleted documents from any result set.
// Server-side filtering via where("deleted","!=",true) requires a composite
// index with every orderBy field — indexes are added to firestore.indexes.json.
// Until those indexes are deployed, this client-side filter is the safety net.
function excludeDeleted(docs: Subscriber[]): Subscriber[] {
  return docs.filter((d) => d.deleted !== true);
}

export const subscriberService = {
  async getAll(): Promise<Subscriber[]> {
    // Read everything and filter here — see rejectDeleted in lib/softDelete.
    // The server-side inequality filter used to drop all 51 live subscribers.
    const snapshot = await getDocs(collection(db, SUBS));
    return excludeDeleted(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Subscriber)));
  },

  async getById(id: string): Promise<Subscriber | null> {
    const snap = await getDoc(doc(db, SUBS, id));
    if (!snap.exists()) return null;
    const data = { id: snap.id, ...snap.data() } as Subscriber;
    return data.deleted === true ? null : data;
  },

  async getActive(): Promise<Subscriber[]> {
    const q = query(
      collection(db, SUBS),
      where("subscriptionState", "==", "active")
    );
    const snapshot = await getDocs(q);
    return excludeDeleted(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Subscriber)));
  },

  async getWithdrawn(): Promise<Subscriber[]> {
    const q = query(
      collection(db, SUBS),
      where("subscriptionState", "==", "withdrawn")
    );
    const snapshot = await getDocs(q);
    return excludeDeleted(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Subscriber)));
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
