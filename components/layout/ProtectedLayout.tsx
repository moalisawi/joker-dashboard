"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants } from "@/lib/animations";
import { useAuthStore } from "@/store/authStore";
import { useNotificationsListener } from "@/hooks/useNotificationsListener";
import { usePresence }  from "@/hooks/usePresence";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import Sidebar           from "./Sidebar";
import ServerHealthBanner from "./ServerHealthBanner";
import TopNav            from "./TopNav";
import GlobalSearch        from "@/components/search/GlobalSearch";
import EmployeeQuickCard   from "@/components/employees/EmployeeQuickCard";
import SubscriberQuickCard from "@/components/subscribers/SubscriberQuickCard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  useNotificationsListener();
  usePresence();   // RTDB presence + force-logout listener
  useHeartbeat();  // 30s RTDB + 60s REST heartbeats

  const router   = useRouter();
  const pathname = usePathname();
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
          <div className="w-11 h-11 rounded-full border-[3px] animate-spin" style={{ borderColor: "#5B5FEF", borderTopColor: "transparent" }} />
          <p className="text-sm font-medium" style={{ color: "#6B7280" }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!uid) return null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page-bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        {/* Above the nav, not inside it: a deployment that cannot save is the
            first thing staff need to know, before anything they might try. */}
        <ServerHealthBanner />
        <div className="sticky top-0 z-30 px-3 md:px-5 pt-2 md:pt-3" style={{
          background: "rgba(245,247,251,0.85)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(229,231,235,0.60)",
        }}>
          <TopNav />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            className="flex-1"
            variants={pageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <GlobalSearch />
      <EmployeeQuickCard />
      <SubscriberQuickCard />
    </div>
  );
}
