"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useAuthListener } from "@/hooks/useAuth";
import { useNotificationsListener } from "@/hooks/useNotificationsListener";
import Sidebar from "./Sidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  useAuthListener();
  useNotificationsListener();

  const router = useRouter();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page-bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
