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
import { RefundTransaction } from "@/types";

interface UseRefundsOptions {
  subscriberId?: string;
  dateRange?: { start: string; end: string };
  limit?: number;
}

export function useRefunds(options: UseRefundsOptions = {}) {
  const [refunds, setRefunds] = useState<RefundTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Build constraints based on options
      const constraints: any[] = [orderBy("refundDate", "desc")];

      if (options.subscriberId) {
        constraints.push(where("subscriberId", "==", options.subscriberId));
      }

      if (options.dateRange) {
        constraints.push(
          where("refundDate", ">=", options.dateRange.start),
          where("refundDate", "<=", options.dateRange.end)
        );
      }

      const q: Query = query(collection(db, "refunds"), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data: RefundTransaction[] = [];
          snapshot.forEach((doc) => {
            data.push({
              id: doc.id,
              ...doc.data(),
            } as RefundTransaction);
          });

          // Apply limit if specified
          if (options.limit && data.length > options.limit) {
            data.length = options.limit;
          }

          setRefunds(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Error fetching refunds:", err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Error setting up refunds listener:", err);
      setError(err.message);
      setLoading(false);
    }
  }, [
    options.subscriberId,
    options.dateRange?.start,
    options.dateRange?.end,
    options.limit,
  ]);

  return { refunds, loading, error };
}
