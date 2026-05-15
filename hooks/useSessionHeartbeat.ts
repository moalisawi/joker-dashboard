"use client";

import { useEffect } from "react";
import { auth } from "@/lib/auth";
import { getSessionId } from "@/lib/sessionLogger";

// Update lastSeenAt every 60 seconds while the tab is visible
const INTERVAL_MS = 60_000;

export function useSessionHeartbeat() {
  useEffect(() => {
    async function beat() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const sessionId = getSessionId();
      const user      = auth.currentUser;
      if (!sessionId || !user) return;

      try {
        const token = await user.getIdToken(false); // use cached token — no forced refresh
        await fetch(`/api/sessions/${sessionId}/heartbeat`, {
          method:    "PATCH",
          headers:   { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
      } catch {
        // Non-fatal
      }
    }

    const timer = setInterval(beat, INTERVAL_MS);
    beat(); // immediate on mount

    return () => clearInterval(timer);
  }, []);
}
