"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, onSnapshot,
} from "firebase/firestore";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { isAccountAccessible } from "@/lib/permissions";
import type { UserProfile, AccountStatus } from "@/types";

/**
 * Sets up:
 *  1. Firebase Auth state listener (login / logout)
 *  2. Realtime Firestore listener on the user document
 *     → permissions / status changes apply instantly
 *     → suspended/disabled accounts are force-logged out
 */
export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();

  // Keep Firestore unsubscriber across re-renders without causing loops
  const unsubFirestoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous Firestore listener before starting a new one
      unsubFirestoreRef.current?.();
      unsubFirestoreRef.current = null;

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      // Ensure user document exists (first login auto-provisioning)
      try {
        const initSnap = await import("firebase/firestore").then((m) => m.getDoc(userRef));
        if (!initSnap.exists()) {
          const token = await firebaseUser.getIdToken();
          await fetch("/api/bootstrap-user", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        // Non-fatal — onSnapshot below will still fire
      }

      // Realtime listener — fires immediately and on every doc change
      unsubFirestoreRef.current = onSnapshot(
        userRef,
        async (snap) => {
          if (!snap.exists()) {
            await auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }

          const data = snap.data();
          const status: AccountStatus = data.status ?? (data.active ? "active" : "disabled");

          // Enforce account status — force logout for non-active accounts
          if (!isAccountAccessible(status, data.active ?? true)) {
            await auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }

          const profile: UserProfile = {
            uid:                  firebaseUser.uid,
            email:                firebaseUser.email || "",
            name:                 data.name || data.email || "",
            employeeName:         data.employeeName || "",
            role:                 data.role || "employee",
            status,
            active:               data.active ?? true,
            granularPermissions:  data.granularPermissions,
            lastLoginAt:          data.lastLoginAt,
            createdAt:            data.createdAt,
            updatedAt:            data.updatedAt,
            // employee-extended fields
            isEmployee:           data.isEmployee ?? false,
            employeeRole:         data.employeeRole,
            department:           data.department,
            phone:                data.phone,
            teamId:               data.teamId,
            notes:                data.notes,
          };

          setUser(profile);
          setLoading(false);
        },
        (err) => {
          console.error("useAuth Firestore listener error:", err);
          setUser(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubFirestoreRef.current?.();
      unsubFirestoreRef.current = null;
    };
  }, [setUser, setLoading]);
}
