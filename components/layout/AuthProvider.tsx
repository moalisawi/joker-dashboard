"use client";

import { useAuthListener } from "@/hooks/useAuth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuthListener();
  return <>{children}</>;
}
