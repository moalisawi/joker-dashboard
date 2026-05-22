"use client";

import { useState, useCallback } from "react";
import { auth } from "@/lib/auth";
import type { LoginSession, FailedLoginAttempt, SessionSummary } from "@/types";

const DEFAULT_SUMMARY: SessionSummary = {
  totalActive: 0, onlineNow: 0, todayLogins: 0, failedToday: 0,
};

type State = {
  sessions:      LoginSession[];
  failed:        FailedLoginAttempt[];
  summary:       SessionSummary;
  loading:       boolean;
  loadingFailed: boolean;
  error:         string | null;
};

async function getBearerToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try { return await user.getIdToken(); } catch { return null; }
}

export function useSessions() {
  const [state, setState] = useState<State>({
    sessions: [], failed: [], summary: DEFAULT_SUMMARY,
    loading: false, loadingFailed: false, error: null,
  });

  const fetchSessions = useCallback(async () => {
    const token = await getBearerToken();
    if (!token) return;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res  = await fetch("/api/sessions", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch sessions");
      setState((s) => ({
        ...s,
        sessions: data.sessions ?? [],
        summary:  { ...DEFAULT_SUMMARY, ...data.summary },
        loading:  false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s, loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  const fetchFailed = useCallback(async () => {
    const token = await getBearerToken();
    if (!token) return;

    setState((s) => ({ ...s, loadingFailed: true }));
    try {
      const res  = await fetch("/api/sessions/failed", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setState((s) => ({
          ...s,
          failed:       data.attempts ?? [],
          loadingFailed: false,
          // merge failedToday into summary if it came back from this endpoint
          summary: data.todayCount != null
            ? { ...s.summary, failedToday: data.todayCount }
            : s.summary,
        }));
      } else {
        setState((s) => ({ ...s, loadingFailed: false }));
      }
    } catch {
      setState((s) => ({ ...s, loadingFailed: false }));
    }
  }, []);

  const revokeUser = useCallback(async (targetUid: string): Promise<boolean> => {
    const token = await getBearerToken();
    if (!token) return false;

    try {
      const res  = await fetch(`/api/sessions/${targetUid}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed");
      return true;
    } catch (err) {
      console.error("[useSessions] revokeUser:", err);
      return false;
    }
  }, []);

  return { ...state, fetchSessions, fetchFailed, revokeUser };
}
