"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/lib/realtimeDb";

// A session is considered "online now" if its heartbeat is within this window
const STALE_MS = 90_000; // 90 seconds

export interface RealtimeMetrics {
  onlineNow:      number;
  activeSessions: number;
  isConnected:    boolean;
}

type RtdbSession = {
  online?:     boolean;
  lastSeen?:   number;
  heartbeat?:  number;
  terminated?: boolean;
  uid?:        string;
  sessionId?:  string;
};

// ── useRealtimeMetrics ────────────────────────────────────────────────────────
//
// Subscribes to the RTDB `presence/` node and returns live session metrics.
// Suitable for the admin sessions dashboard — updates without any polling.
//
// Metric definitions:
//   onlineNow      — sessions with online=true + heartbeat within 90s
//   activeSessions — all sessions with online=true (may include stale)
//   isConnected    — whether the RTDB WebSocket is currently connected

export function useRealtimeMetrics(): RealtimeMetrics {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    onlineNow:      0,
    activeSessions: 0,
    isConnected:    false,
  });

  useEffect(() => {
    // No-op when RTDB is not configured (env var missing)
    if (!rtdb) return;

    const connectedRef = ref(rtdb, ".info/connected");
    const presenceRef  = ref(rtdb, "presence");

    const unsubConnected = onValue(connectedRef, (snap) => {
      setMetrics((m) => ({ ...m, isConnected: snap.val() === true }));
    });

    const unsubPresence = onValue(presenceRef, (snap) => {
      const root = snap.val() as Record<string, Record<string, RtdbSession>> | null;
      if (!root) {
        setMetrics((m) => ({ ...m, onlineNow: 0, activeSessions: 0 }));
        return;
      }

      let onlineNow      = 0;
      let activeSessions = 0;
      const now          = Date.now();

      for (const userSessions of Object.values(root)) {
        if (!userSessions || typeof userSessions !== "object") continue;
        for (const session of Object.values(userSessions)) {
          if (!session || session.terminated === true) continue;
          if (session.online !== true) continue;

          activeSessions++;
          const beat    = session.heartbeat ?? session.lastSeen ?? 0;
          const isFresh = typeof beat === "number" && (now - beat) < STALE_MS;
          if (isFresh) onlineNow++;
        }
      }

      setMetrics((m) => ({ ...m, onlineNow, activeSessions }));
    });

    return () => {
      unsubConnected();
      unsubPresence();
    };
  }, []);

  return metrics;
}
