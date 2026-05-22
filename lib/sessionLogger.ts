"use client";

import { auth } from "@/lib/auth";

const SESSION_LOGGED_KEY = "jk_session_v3_logged"; // bump version to invalidate old flags
const SESSION_ID_KEY     = "jk_session_v3_id";

// ── Login session logging ─────────────────────────────────────────────────────

export async function logLoginSession(): Promise<void> {
  if (typeof window === "undefined") return;

  // If we already have a valid session ID for this tab, nothing to do
  if (sessionStorage.getItem(SESSION_ID_KEY)) return;

  // Session ID missing — clear the logged flag so we always retry
  sessionStorage.removeItem(SESSION_LOGGED_KEY);

  const user = auth.currentUser;
  if (!user) return;

  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/sessions/log", {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sessionId) {
        sessionStorage.setItem(SESSION_ID_KEY, data.sessionId);
        sessionStorage.setItem(SESSION_LOGGED_KEY, "1");
      }
    } else if (res.status === 202) {
      // Admin credentials missing in dev — mark temporarily so we don't spam
      sessionStorage.setItem(SESSION_LOGGED_KEY, "1");
    } else {
      const body = await res.json().catch(() => ({}));
      console.warn("[sessions] log failed —", res.status, body.error ?? res.statusText);
    }
  } catch (err) {
    console.warn("[sessions] log error —", err instanceof Error ? err.message : err);
  }
}

// ── Logout session logging ────────────────────────────────────────────────────

export async function logSessionLogout(): Promise<void> {
  if (typeof window === "undefined") return;

  const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  const user      = auth.currentUser;
  if (!sessionId || !user) return;

  try {
    const token = await user.getIdToken();
    await fetch(`/api/sessions/${sessionId}/logout`, {
      method:    "PATCH",
      headers:   { Authorization: `Bearer ${token}` },
      keepalive: true, // survives page unload
    });
  } catch {
    // Non-fatal
  } finally {
    sessionStorage.removeItem(SESSION_LOGGED_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  }
}

// ── Failed login logging ──────────────────────────────────────────────────────

export async function logFailedLogin(email: string, reason: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/sessions/failed", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: email.trim().toLowerCase(), reason }),
    });
  } catch {
    // Non-fatal
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_ID_KEY);
}
