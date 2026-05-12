"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments }    from "@/hooks/usePayments";
import { useAuthStore }   from "@/store/authStore";
import { useThemeStore }  from "@/store/themeStore";
import {
  exportSubscribersCSV,
  exportPaymentsCSV,
  exportEmployeePerformanceCSV,
} from "@/lib/analytics/reports";
import { canExportReports, canViewFinancialReports } from "@/lib/permissionGuards";
import { Download, Users, CreditCard, Briefcase, FileText, Calendar } from "lucide-react";

export default function ReportsPage() {
  const router     = useRouter();
  const { user }   = useAuthStore();
  const { dark }   = useThemeStore();
  const { loading } = useAuthStore();

  const { subscribers } = useSubscribers();
  const { payments }    = usePayments({});

  const canExport  = canExportReports(user)        || user?.role === "owner" || user?.role === "admin";
  const canViewFin = canViewFinancialReports(user)  || user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    if (!loading && user && !canExport && !canViewFin) router.replace("/");
  }, [user, loading, router, canExport, canViewFin]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const card = dark ? "rgba(255,255,255,0.035)" : "var(--surface)";
  const brd  = dark ? "rgba(255,255,255,0.07)"  : "var(--border)";

  const reports = [
    {
      key: "subscribers",
      icon: <Users size={20}/>,
      label: "تقرير المشتركين",
      description: "قائمة كاملة بالمشتركين مع بياناتهم المالية",
      color: "#6366f1",
      onExport: () => exportSubscribersCSV(subscribers, { dateFrom: dateFrom||undefined, dateTo: dateTo||undefined }),
    },
    {
      key: "payments",
      icon: <CreditCard size={20}/>,
      label: "تقرير المدفوعات",
      description: "جميع الدفعات مع العملات وأساليب الدفع",
      color: "#10b981",
      restricted: !canViewFin,
      onExport: () => exportPaymentsCSV(payments, dateFrom||undefined, dateTo||undefined),
    },
    {
      key: "employees",
      icon: <Briefcase size={20}/>,
      label: "أداء الموظفين",
      description: "مقارنة أداء الموظفين بالإيراد والمشتركين",
      color: "#f59e0b",
      onExport: () => exportEmployeePerformanceCSV(subscribers),
    },
  ];

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 flex items-center justify-center rounded-xl"
              style={{ background: "#6366f118", border: "1px solid #6366f128" }}>
              <FileText size={16} style={{ color: "#6366f1" }}/>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                التقارير والتصدير
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                تصدير البيانات بصيغة CSV
              </p>
            </div>
          </div>

          {/* Date filters */}
          <div className="flex flex-wrap gap-3 p-4 rounded-2xl"
            style={{ background: card, border: `1px solid ${brd}` }}>
            <div className="flex items-center gap-2">
              <Calendar size={14} style={{ color: "var(--text-muted)" }}/>
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>فلترة بالتاريخ:</span>
            </div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="form-input text-sm" dir="ltr" placeholder="من"/>
            <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}
              className="form-input text-sm" dir="ltr" placeholder="إلى"/>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "#f43f5e18", color: "#f43f5e" }}>
                مسح
              </button>
            )}
          </div>

          {/* Report cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <div key={r.key}
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ background: card, border: `1px solid ${brd}`, opacity: r.restricted ? 0.5 : 1 }}>
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 flex items-center justify-center rounded-xl"
                    style={{ background: `${r.color}18`, border: `1px solid ${r.color}28` }}>
                    <span style={{ color: r.color }}>{r.icon}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>{r.label}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.description}</p>
                  {r.restricted && (
                    <p className="text-xs mt-1.5 font-semibold" style={{ color: "#f43f5e" }}>
                      يتطلب صلاحية عرض البيانات المالية
                    </p>
                  )}
                </div>
                <button
                  onClick={r.restricted ? undefined : r.onExport}
                  disabled={r.restricted || !canExport}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{ background: r.restricted || !canExport ? "#94a3b8" : `linear-gradient(135deg,${r.color}dd,${r.color}99)` }}>
                  <Download size={14}/>
                  تصدير CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
