"use client";

import { useEffect, useRef } from "react";
import {
  ref,
  set,
  update,
  onValue,
  onDisconnect as rtdbOnDisconnect,
  serverTimestamp,
} from "firebase/database";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { rtdb } from "@/lib/realtimeDb";
import { auth } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { getSessionId } from "@/lib/sessionLogger";

// ── Device detection (no external deps) ──────────────────────────────────────

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\/[\d.]+/.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}

function detectOS(ua: string): string {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function detectDevice(ua: string): "desktop" | "mobile" | "tablet" {
  if (/iPhone|Android.*Mobile|BlackBerry|IEMobile/i.test(ua)) return "mobile";
  if (/iPad|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  return "desktop";
}

// ── usePresence ───────────────────────────────────────────────────────────────
//
// Manages realtime presence in Firebase RTDB: presence/{uid}/{sessionId}
// Gracefully no-ops when RTDB is unavailable (no databaseURL configured).
//
// Responsibilities:
//   - Write online state on connect, set offline on disconnect (onDisconnect)
//   - Update currentPage when pathname changes
//   - Watch for `terminated` flag → instant force logout

export function usePresence() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();

  // Keep a live ref to pathname so the connection listener always reads latest
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  });

  // Main presence lifecycle — runs once per authenticated uid
  useEffect(() => {
    // Degrade gracefully when RTDB is not configured
    if (!user || !rtdb) return;

    let mounted       = true;
    let attempts      = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubConnected:  (() => void) | null = null;
    let unsubTerminated: (() => void) | null = null;
    let activePath: string | null = null;

    function initPresence() {
      const sessionId = getSessionId();
      if (!sessionId) {
        if (attempts++ < 20 && mounted) {
          retryTimer = setTimeout(initPresence, 500);
        }
        return;
      }

      if (!mounted || !rtdb || !user) return;

      const ua          = typeof navigator !== "undefined" ? navigator.userAgent : "";
      activePath        = `presence/${user.uid}/${sessionId}`;
      const presenceRef = ref(rtdb, activePath);

      const baseData = {
        uid:        user.uid,
        sessionId,
        browser:    detectBrowser(ua),
        os:         detectOS(ua),
        device:     detectDevice(ua),
        loginAt:    Date.now(),
        terminated: false,
      };

      const connectedRef = ref(rtdb, ".info/connected");
      unsubConnected = onValue(connectedRef, (snap) => {
        if (!snap.val() || !rtdb) return;

        // Register disconnect handler — marks offline without full delete
        rtdbOnDisconnect(presenceRef).update({
          online:   false,
          lastSeen: serverTimestamp(),
        });

        // Write full presence record
        set(presenceRef, {
          ...baseData,
          online:      true,
          currentPage: pathnameRef.current,
          lastSeen:    serverTimestamp(),
          heartbeat:   Date.now(),
        });
      });

      // Admin sets terminated=true → instant force logout
      const terminatedRef = ref(rtdb, `${activePath}/terminated`);
      unsubTerminated = onValue(terminatedRef, async (snap) => {
        if (snap.val() !== true) return;
        try { await signOut(auth); } catch { /* non-fatal */ }
        if (mounted) router.replace("/login");
      });
    }

    initPresence();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      unsubConnected?.();
      unsubTerminated?.();
      // Mark offline synchronously before unmount
      if (activePath && rtdb) {
        update(ref(rtdb, activePath), { online: false, lastSeen: serverTimestamp() }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Update currentPage in RTDB whenever pathname changes
  useEffect(() => {
    if (!user || !rtdb) return;
    const sessionId = getSessionId();
    if (!sessionId) return;
    update(ref(rtdb, `presence/${user.uid}/${sessionId}`), {
      currentPage: pathname,
    }).catch(() => {});
  }, [pathname, user?.uid]);
}
