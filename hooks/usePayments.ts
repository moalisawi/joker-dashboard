"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Query,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { PaymentTransaction } from "@/types";

interface UsePaymentsOptions {
  subscriberId?: string;
  dateRange?: { start: string; end: string };
  paymentMethod?: string;
  limit?: number;
}

export function usePayments(options: UsePaymentsOptions = {}) {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Build constraints based on options
      const constraints: any[] = [orderBy("date", "desc")];

      if (options.subscriberId) {
        constraints.push(where("subscriberId", "==", options.subscriberId));
      }

      if (options.dateRange) {
        constraints.push(
          where("date", ">=", options.dateRange.start),
          where("date", "<=", options.dateRange.end)
        );
      }

      if (options.paymentMethod) {
        constraints.push(where("paymentMethod", "==", options.paymentMethod));
      }

      const q: Query = query(collection(db, "payments"), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data: PaymentTransaction[] = [];
          snapshot.forEach((doc) => {
            data.push({
              id: doc.id,
              ...doc.data(),
            } as PaymentTransaction);
          });

          // Apply limit if specified
          if (options.limit && data.length > options.limit) {
            data.length = options.limit;
          }

          setPayments(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Error fetching payments:", err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Error setting up payments listener:", err);
      setError(err.message);
      setLoading(false);
    }
  }, [
    options.subscriberId,
    options.dateRange?.start,
    options.dateRange?.end,
    options.paymentMethod,
    options.limit,
  ]);

  return { payments, loading, error };
}
