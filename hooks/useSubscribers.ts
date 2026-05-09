"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, where, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { normalizeSubscriber } from "@/lib/utils";
import type { Subscriber } from "@/types";

export function useSubscribers() {
  const { user, can } = useAuthStore();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const base = collection(db, "subscribers");
    const q = can("canViewAll")
      ? query(base, orderBy("createdAt", "desc"))
      : query(
          base,
          where(
            "convincedBy",
            "==",
            user.employeeName || user.name || ""
          )
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => normalizeSubscriber({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setSubscribers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, can]);

  return { subscribers, loading, error };
}
