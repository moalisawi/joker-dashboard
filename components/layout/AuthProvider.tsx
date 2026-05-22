"use client";

import { useAuthListener } from "@/hooks/useAuth";

/**
 * Mounts the Firebase auth + Firestore user listener exactly once at the
 * application root. Placing this in the root layout ensures the listener
 * is never torn down during client-side route changes, which prevents the
 * duplicate-listener race condition that occurred when useAuthListener was
 * called from both LoginPage and ProtectedLayout simultaneously.
 */
export default function AuthProvider() {
  useAuthListener();
  return null;
}
