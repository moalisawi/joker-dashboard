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
          const roleOk = userRank >= minRoleRank(n.targetMinRole ?? "employee");
          const targeted = Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.uid);
          // targeted notifications: show only if explicitly targeted (bypass role check for employees)
          if (Array.isArray(n.targetUserIds) && n.targetUserIds.length > 0) {
            return targeted || userRank >= minRoleRank("admin");
          }
          return roleOk;
        });

        setNotifications(visible);
      },
      (err) => {
        console.error("[useNotificationsListener]", err);
        setLoading(false);
      }
    );

    // Run smart alert checks after the listener is set up
    alertEngineService.runAll().catch(console.warn);

    return () => unsub();
  }, [user?.uid, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
}
