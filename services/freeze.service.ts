/**
 * Freeze Service
 * Read-side helpers plus protected server operations for freeze/resume.
 */

import type { Timestamp } from "firebase/firestore";
import type { Subscriber, FreezeData, FreezeFreezeRequest, FreezeResumeRequest } from "@/types";
import { callSubscriberOperation } from "@/lib/clientOperations";

export const freezeService = {
  calculateRemainingDays(fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = to.getTime() - from.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  },

  addDaysToDate(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  },

  async freeze(request: FreezeFreezeRequest): Promise<void> {
    await callSubscriberOperation("freezeSubscription", {
      subscriberId: request.subscriberId,
      reason: request.reason,
      notes: request.notes,
    });
  },

  async resume(request: FreezeResumeRequest): Promise<void> {
    await callSubscriberOperation("resumeSubscription", {
      subscriberId: request.subscriberId,
    });
  },

  getFreezeDuration(freezeData: FreezeData | undefined): number {
    if (!freezeData?.frozenAt) return 0;
    const frozenAt =
      (freezeData.frozenAt as Timestamp)?.toDate?.() ||
      new Date(freezeData.frozenAt as unknown as string);
    const now = new Date();
    const diffTime = now.getTime() - frozenAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  },

  isFrozen(subscriber: Subscriber): boolean {
    return subscriber.freezeData?.isFrozen === true;
  },

  getFreezeInfo(subscriber: Subscriber): {
    isFrozen: boolean;
    frozenSinceDays: number;
    remainingDays: number;
    preservedExpiryDate: string | null;
  } {
    const freezeData = subscriber.freezeData;
    return {
      isFrozen: freezeData?.isFrozen === true,
      frozenSinceDays: this.getFreezeDuration(freezeData),
      remainingDays: freezeData?.remainingDays || 0,
      preservedExpiryDate: freezeData?.originalExpiryDate || null,
    };
  },
};
