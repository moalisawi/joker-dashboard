"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { isAccountAccessible } from "@/lib/permissions";
import { logLoginSession } from "@/lib/sessionLogger";
import type { UserProfile, AccountStatus } from "@/types";

/**
 * Sets up:
 *  1. Firebase Auth state listener (login / logout)
 *  2. Realtime Firestore listener on the user document
 *     → permissions / status changes apply instantly
 *     → suspended/disabled accounts are force-logged out
 *
 * Design principles:
 *  - Effect runs ONCE (empty dep array). Auth and Firestore listeners are
 *    managed internally, not re-created on parent re-renders.
 *  - Async work inside onAuthStateChanged is guarded by a per-invocation
 *    `isCancelled` flag so stale callbacks never write stale state.
 *  - State updates are ATOMIC (single setState call) to prevent the
 *    intermediate state where user is set but loading is still true.
 */
export function useAuthListener() {
  const unsubFirestoreRef = useRef<(() => void) | null>(null);
  // Cancels the in-flight async setup when auth state changes again
  const cancelAsyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // If Firebase Auth doesn't resolve within 15s, unblock the UI
    const safetyTimer = setTimeout(() => {
      useAuthStore.setState({ loading: false });
    }, 15_000);

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(safetyTimer);

      // Cancel any in-flight async setup from the previous auth event
      cancelAsyncRef.current?.();
      cancelAsyncRef.current = null;

      // Tear down the previous Firestore listener synchronously
      unsubFirestoreRef.current?.();
      unsubFirestoreRef.current = null;

      if (!firebaseUser) {
        useAuthStore.setState({ user: null, loading: false });
        return;
      }

      // --- Async setup, guarded by isCancelled ---
      let isCancelled = false;
      cancelAsyncRef.current = () => { isCancelled = true; };

      const userRef = doc(db, "users", firebaseUser.uid);

      (async () => {
        // Ensure the user document exists (first-login auto-provisioning)
        try {
          const initSnap = await Promise.race([
            getDoc(userRef),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("getDoc timeout")), 6_000)
            ),
          ]);

          if (isCancelled) return;

          if (!initSnap.exists()) {
            const token = await firebaseUser.getIdToken();
            if (isCancelled) return;
            await fetch("/api/bootstrap-user", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (isCancelled) return;
          }
        } catch (err) {
          if (isCancelled) return;
          console.warn("[AUTH] getDoc/bootstrap error (non-fatal):", err);
        }

        if (isCancelled) return;

        // Realtime listener — fires immediately and on every doc change
        unsubFirestoreRef.current = onSnapshot(
          userRef,
          (snap) => {
            if (isCancelled) return;

            if (!snap.exists()) {
              auth.signOut();
              useAuthStore.setState({ user: null, loading: false });
              return;
            }

            const data = snap.data();
            const status: AccountStatus =
              data.status ?? (data.active ? "active" : "disabled");

            if (!isAccountAccessible(status, data.active ?? true)) {
              auth.signOut();
              useAuthStore.setState({ user: null, loading: false });
              return;
            }

            const profile: UserProfile = {
              uid:                 firebaseUser.uid,
              email:               firebaseUser.email || "",
              name:                data.name || data.email || "",
              employeeName:        data.employeeName || "",
              role:                data.role || "employee",
              status,
              active:              data.active ?? true,
              granularPermissions: data.granularPermissions,
              lastLoginAt:         data.lastLoginAt,
              createdAt:           data.createdAt,
              updatedAt:           data.updatedAt,
              isEmployee:          data.isEmployee ?? false,
              employeeRole:        data.employeeRole,
              department:          data.department,
              phone:               data.phone,
              teamId:              data.teamId,
              notes:               data.notes,
            };

            // Single atomic state update — prevents the double-render caused
            // by calling setUser() and setLoading() as separate operations.
            useAuthStore.setState({ user: profile, loading: false });

            // Log the session once per browser tab (guarded by sessionStorage)
            logLoginSession();
          },
          (err) => {
            if (isCancelled) return;
            console.error("[FIRESTORE] user listener error:", err);
            useAuthStore.setState({ user: null, loading: false });
          }
        );
      })();
    });

    return () => {
      // Mark all pending async work as cancelled
      cancelAsyncRef.current?.();
      cancelAsyncRef.current = null;
      clearTimeout(safetyTimer);
      unsubAuth();
      unsubFirestoreRef.current?.();
      unsubFirestoreRef.current = null;
    };
  // Empty dep array: this effect is intentionally a singleton.
  // Auth/Firestore listeners manage their own lifecycle internally.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
