"use client";

import { useEffect } from "react";
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { alertEngineService } from "@/services/alert-engine.service";
import type { AppNotification, NotificationMinRole } from "@/types";

const ROLE_RANK: Record<string, number> = {
  employee: 0,
  admin:    1,
  owner:    2,
};

function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0;
}

function minRoleRank(minRole: NotificationMinRole): number {
  return ROLE_RANK[minRole] ?? 0;
}

/**
 * Sets up the global real-time Firestore listener for notifications.
 * Call once in ProtectedLayout so all descendant components share the same store.
 */
export function useNotificationsListener() {
  const { user } = useAuthStore();
  const { setNotifications, setLoading } = useNotificationStore();

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const q = query(
      collection(db, "notifications"),
      where("archived", "==", false),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AppNotification)
        );

        // Filter: show if role qualifies OR explicitly targeted by uid
        const userRank = roleRank(user.role);
        const visible  = all.filter((n) => {
          if (Array.isArray(n.targetUserIds) && n.targetUserIds.length > 0) {
            const targeted = n.targetUserIds.includes(user.uid);
            return targeted || userRank >= minRoleRank("admin");
          }
          return userRank >= minRoleRank(n.targetMinRole ?? "employee");
        });

        setNotifications(visible);
      },
      (err) => {
        console.error("[FIRESTORE] notifications listener error:", err);
        setLoading(false);
      }
    );

    // Run smart alert checks after the listener is set up.
    // runAll() has a 10-minute localStorage cooldown so it won't
    // hammer Firestore on every re-mount.
    alertEngineService.runAll().catch(console.warn);

    return () => { unsub(); };
  // user.uid and user.role are primitive strings — stable across object re-creates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);
}
