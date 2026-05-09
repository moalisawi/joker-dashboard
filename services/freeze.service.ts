/**
 * Freeze Service
 * Handle subscription freeze/resume operations with preserved days
 */

import {
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { Subscriber, FreezeData, FreezeFreezeRequest, FreezeResumeRequest, UserProfile } from "@/types";
import { writeAuditLog } from "@/lib/auditLog";

export const freezeService = {
  /**
   * Calculate remaining days between two dates
   */
  calculateRemainingDays(fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = to.getTime() - from.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  },

  /**
   * Add days to a date
   */
  addDaysToDate(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  },

  /**
   * Freeze a subscription
   * Preserves remaining days and stops expiry countdown
   */
  async freeze(request: FreezeFreezeRequest): Promise<void> {
    try {
      const subscriberRef = doc(db, "subscribers", request.subscriberId);
      const subscriberSnap = await getDoc(subscriberRef);

      if (!subscriberSnap.exists()) {
        throw new Error("Subscriber not found");
      }

      const subscriber = subscriberSnap.data() as Subscriber;

      // Only active subscriptions can be frozen
      if (subscriber.status !== "نشط") {
        throw new Error("Only active subscriptions can be frozen");
      }

      // Calculate remaining days
      const today = new Date().toISOString().split("T")[0];
      const remainingDays = this.calculateRemainingDays(today, subscriber.expiryDate);

      // Create freeze data
      const freezeData: FreezeData = {
        isFrozen: true,
        frozenAt: serverTimestamp() as Timestamp,
        frozenBy: request.freezedBy,
        freezeReason: request.reason,
        freezeNotes: request.notes,
        originalExpiryDate: subscriber.expiryDate,
        remainingDays: Math.max(0, remainingDays),
        resumedAt: null,
        resumedBy: null,
      };

      // Update subscriber
      await updateDoc(subscriberRef, {
        freezeData,
        status: "متجمد",
        subscriptionStatus: "frozen",
        updatedAt: serverTimestamp(),
        updatedBy: request.freezedBy,
      });

      // Log audit event
      const freezeActor = { uid: request.freezedBy, name: request.frozenByName, email: "", role: "employee", active: true } as UserProfile;
      await writeAuditLog(freezeActor, "subscriber_frozen", {
        targetType: "subscriber",
        targetId: request.subscriberId,
        targetName: subscriber.name,
        summary: `تم تجميد اشتراك: ${subscriber.name}`,
        metadata: {
          reason: request.reason,
          remainingDays: freezeData.remainingDays,
          originalExpiryDate: subscriber.expiryDate,
        },
      });
    } catch (error) {
      console.error("Error freezing subscription:", error);
      throw error;
    }
  },

  /**
   * Resume a frozen subscription
   * Adds preserved days to today's date
   */
  async resume(request: FreezeResumeRequest): Promise<void> {
    try {
      const subscriberRef = doc(db, "subscribers", request.subscriberId);
      const subscriberSnap = await getDoc(subscriberRef);

      if (!subscriberSnap.exists()) {
        throw new Error("Subscriber not found");
      }

      const subscriber = subscriberSnap.data() as Subscriber;
      const freezeData = subscriber.freezeData;

      // Only frozen subscriptions can be resumed
      if (!freezeData?.isFrozen) {
        throw new Error("Only frozen subscriptions can be resumed");
      }

      // Calculate new expiry date
      const today = new Date().toISOString().split("T")[0];
      const newExpiryDate = this.addDaysToDate(today, freezeData.remainingDays);

      // Update freeze data
      const updatedFreezeData: FreezeData = {
        ...freezeData,
        isFrozen: false,
        resumedAt: serverTimestamp() as Timestamp,
        resumedBy: request.resumedBy,
      };

      // Calculate new days remaining for the subscriber
      const newDaysRemaining = freezeData.remainingDays;

      // Update subscriber
      await updateDoc(subscriberRef, {
        freezeData: updatedFreezeData,
        expiryDate: newExpiryDate,
        daysRemaining: newDaysRemaining,
        status: "نشط",
        subscriptionStatus: "active",
        updatedAt: serverTimestamp(),
        updatedBy: request.resumedBy,
      });

      // Log audit event
      const resumeActor = { uid: request.resumedBy, name: request.resumedByName, email: "", role: "employee", active: true } as UserProfile;
      const frozenMs = (freezeData.frozenAt as any)?.toDate?.().getTime?.() ?? 0;
      const frozenDays = frozenMs > 0 ? Math.ceil((Date.now() - frozenMs) / (1000 * 60 * 60 * 24)) : 0;
      await writeAuditLog(resumeActor, "subscriber_resumed", {
        targetType: "subscriber",
        targetId: request.subscriberId,
        targetName: subscriber.name,
        summary: `تم استئناف اشتراك: ${subscriber.name} | ينتهي ${newExpiryDate}`,
        metadata: {
          frozenDays,
          preservedDays: freezeData.remainingDays,
          newExpiryDate,
        },
      });
    } catch (error) {
      console.error("Error resuming subscription:", error);
      throw error;
    }
  },

  /**
   * Get freeze duration in days
   */
  getFreezeDuration(freezeData: FreezeData | undefined): number {
    if (!freezeData?.frozenAt) return 0;
    const frozenAt = (freezeData.frozenAt as any)?.toDate?.() || new Date(freezeData.frozenAt as any);
    const now = new Date();
    const diffTime = now.getTime() - frozenAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if subscription is frozen
   */
  isFrozen(subscriber: Subscriber): boolean {
    return subscriber.freezeData?.isFrozen === true;
  },

  /**
   * Get freeze info summary
   */
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
