"use client";

import { useEffect } from "react";
import { ref, update, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/realtimeDb";
import { auth } from "@/lib/auth";
import { getSessionId } from "@/lib/sessionLogger";

const RTDB_MS = 30_000;  // fast — updates online indicator
const REST_MS = 60_000;  // slower — updates Firestore via API

// ── useHeartbeat ──────────────────────────────────────────────────────────────
//
// Dual-channel heartbeat:
//   - Every 30s → RTDB presence update (keeps online indicator fresh)
//   - Every 60s → REST PATCH to /api/sessions/:id/heartbeat (Firestore update)
//
// Skips when tab is hidden to avoid wasted writes.
// Replaces the legacy useSessionHeartbeat hook.

export function useHeartbeat() {
  useEffect(() => {
    function isVisible() {
      return typeof document === "undefined" || document.visibilityState === "visible";
    }

    async function rtdbBeat() {
      if (!isVisible() || !rtdb) return;
      const sessionId = getSessionId();
      const user      = auth.currentUser;
      if (!sessionId || !user) return;

      update(ref(rtdb, `presence/${user.uid}/${sessionId}`), {
        lastSeen:  serverTimestamp(),
        heartbeat: Date.now(),
        online:    true,
      }).catch(() => {});
    }

    async function restBeat() {
      if (!isVisible()) return;
      const sessionId = getSessionId();
      const user      = auth.currentUser;
      if (!sessionId || !user) return;

      try {
        const token = await user.getIdToken(false);
        await fetch(`/api/sessions/${sessionId}/heartbeat`, {
          method:    "PATCH",
          headers:   { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
      } catch { /* non-fatal */ }
    }

    const rtdbTimer = setInterval(rtdbBeat, RTDB_MS);
    const restTimer = setInterval(restBeat, REST_MS);

    // Immediate first beats
    rtdbBeat();
    restBeat();

    return () => {
      clearInterval(rtdbTimer);
      clearInterval(restTimer);
    };
  }, []);
}
