"use client";

import { useState, useCallback } from "react";
import type { Subscriber } from "@/types";
import { freezeService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";

export interface UseFrozenReturn {
  // State
  isFrozen: boolean;
  freezeDuration: number;
  remainingDays: number;
  preservedExpiryDate: string | null;
  freezeReason: string | undefined;

  // Operations
  freeze: (reason?: string) => Promise<void>;
  resume: () => Promise<void>;
  
  // UI
  loading: boolean;
  error: string | null;
}

/**
 * Hook to manage subscription freeze operations
 */
export function useFrozen(subscriber: Subscriber | null): UseFrozenReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const isFrozen = subscriber ? freezeService.isFrozen(subscriber) : false;
  const freezeInfo = subscriber
    ? freezeService.getFreezeInfo(subscriber)
    : { isFrozen: false, frozenSinceDays: 0, remainingDays: 0, preservedExpiryDate: null };

  const freeze = useCallback(
    async (reason?: string) => {
      if (!subscriber || !user) return;

      try {
        setLoading(true);
        setError(null);

        await callSubscriberOperation("freezeSubscription", {
          subscriberId: subscriber.id,
          reason,
        });
      } catch (err: any) {
        console.error("Error freezing:", err);
        setError(err.message || "Failed to freeze subscription");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [subscriber, user]
  );

  const resume = useCallback(async () => {
    if (!subscriber || !user) return;

    try {
      setLoading(true);
      setError(null);

      await callSubscriberOperation("resumeSubscription", {
        subscriberId: subscriber.id,
      });
    } catch (err: any) {
      console.error("Error resuming:", err);
      setError(err.message || "Failed to resume subscription");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscriber, user]);

  return {
    isFrozen: freezeInfo.isFrozen,
    freezeDuration: freezeInfo.frozenSinceDays,
    remainingDays: freezeInfo.remainingDays,
    preservedExpiryDate: freezeInfo.preservedExpiryDate,
    freezeReason: subscriber?.freezeData?.freezeReason,
    freeze,
    resume,
    loading,
    error,
  };
}
