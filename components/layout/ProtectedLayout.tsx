"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useNotificationsListener } from "@/hooks/useNotificationsListener";
import { useSessionHeartbeat }   from "@/hooks/useSessionHeartbeat";
import Sidebar           from "./Sidebar";
import TopNav            from "./TopNav";
import GlobalSearch      from "@/components/search/GlobalSearch";
import EmployeeQuickCard from "@/components/employees/EmployeeQuickCard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  useNotificationsListener();
  useSessionHeartbeat();

  const router = useRouter();
  const { user, loading } = useAuthStore();

  // Use primitive deps (uid string + loading boolean) instead of the user
  // object reference. setUser() creates a new object on every Firestore
  // snapshot even when data is unchanged, which would cause this effect to
  // re-run on every snapshot — potentially triggering repeated router.replace.
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!loading && !uid) {
      router.replace("/login");
    }
  }, [uid, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full border-[3px] animate-spin" style={{ borderColor: "#10141A", borderTopColor: "transparent" }} />
          <p className="text-sm font-medium" style={{ color: "#64748B" }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!uid) return null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page-bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        <div className="sticky top-0 z-30 px-5 pt-3" style={{
          background: "rgba(245,247,251,0.80)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(229,231,235,0.60)",
        }}>
          <TopNav />
        </div>
        <div className="flex-1">
          {children}
        </div>
      </main>
      <GlobalSearch />
      <EmployeeQuickCard />
    </div>
  );
}
