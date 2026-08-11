"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Query,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { MonthlyAnalytics } from "@/types";

interface UseMonthlyAnalyticsOptions {
  months?: string[]; // YYYY-MM format
  dateRange?: { start: string; end: string };
  employee?: string;
  refresh?: boolean;
}

export function useMonthlyAnalytics(options: UseMonthlyAnalyticsOptions = {}) {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (options.months && options.months.length > 0) {
        // Fetch specific months
        const unsubscribers: (() => void)[] = [];

        // forEach, not map: the callback exists for its side effect — it opens
        // an onSnapshot listener per month and collects the unsubscribers. The
        // mapped array was never read, so it only allocated a list of undefined.
        options.months.forEach((month) => {
          const q = query(
            collection(db, "monthlyAnalytics"),
            where("month", "==", month)
          );

          const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              const data: MonthlyAnalytics[] = [];
              snapshot.forEach((d) => {
                data.push({
                  id: d.id,
                  ...d.data(),
                } as MonthlyAnalytics);
              });
              setAnalytics((prev) => [...prev, ...data]);
              setLoading(false);
            },
            (err) => {
              console.error(`Error fetching analytics for ${month}:`, err);
              setError(err.message);
              setLoading(false);
            }
          );

          unsubscribers.push(unsubscribe);
        });

        return () => unsubscribers.forEach((unsub) => unsub());
      } else if (options.dateRange) {
        // Fetch month range
        const constraints: QueryConstraint[] = [
          where("month", ">=", options.dateRange.start.slice(0, 7)),
          where("month", "<=", options.dateRange.end.slice(0, 7)),
          orderBy("month", "desc"),
        ];

        const q: Query = query(collection(db, "monthlyAnalytics"), ...constraints);

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const data: MonthlyAnalytics[] = [];
            snapshot.forEach((d) => {
              data.push({
                id: d.id,
                ...d.data(),
              } as MonthlyAnalytics);
            });
            setAnalytics(data);
            setLoading(false);
          },
          (err) => {
            console.error("Error fetching analytics:", err);
            setError(err.message);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } else {
        // Fetch all analytics
        const q = query(collection(db, "monthlyAnalytics"), orderBy("month", "desc"));

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const data: MonthlyAnalytics[] = [];
            snapshot.forEach((d) => {
              data.push({
                id: d.id,
                ...d.data(),
              } as MonthlyAnalytics);
            });
            setAnalytics(data);
            setLoading(false);
          },
          (err) => {
            console.error("Error fetching analytics:", err);
            setError(err.message);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      }
    } catch (err: unknown) {
      console.error("Error setting up analytics listener:", err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [
    options.months?.join(","),
    options.dateRange?.start,
    options.dateRange?.end,
    options.employee,
  ]);

  return { analytics, loading, error };
}

/**
 * Get a single month's analytics
 * Useful for fetching specific month data without real-time updates
 */
export async function getMonthlyAnalytics(month: string): Promise<MonthlyAnalytics | null> {
  try {
    const docRef = doc(db, "monthlyAnalytics", month);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as MonthlyAnalytics;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching analytics for ${month}:`, error);
    return null;
  }
}

/**
 * Calculate summary across multiple months
 */
export function calculateAnalyticsSummary(
  analytics: MonthlyAnalytics[]
): {
  totalPayments: number;
  totalRefunds: number;
  netRevenue: number;
  totalPaymentCount: number;
  totalRefundCount: number;
  totalWithdrawals: number;
} {
  return {
    totalPayments: analytics.reduce(
      (sum, a) => sum + (a.totalPaymentsUSD || 0),
      0
    ),
    totalRefunds: analytics.reduce(
      (sum, a) => sum + (a.totalRefundsUSD || 0),
      0
    ),
    netRevenue: analytics.reduce(
      (sum, a) => sum + (a.netRevenueUSD || 0),
      0
    ),
    totalPaymentCount: analytics.reduce(
      (sum, a) => sum + (a.paymentCount || 0),
      0
    ),
    totalRefundCount: analytics.reduce(
      (sum, a) => sum + (a.refundCount || 0),
      0
    ),
    totalWithdrawals: analytics.reduce(
      (sum, a) => sum + (a.withdrawalCount || 0),
      0
    ),
  };
}
