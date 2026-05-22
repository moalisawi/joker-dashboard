"use client";

import { useState, useCallback } from "react";
import {
  ScrollText, AlertTriangle, DollarSign,
  Calendar, Activity, Download,
  RefreshCw, BarChart2, List,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import AuditFilters from "@/components/logs/AuditFilters";
import AuditCard from "@/components/logs/AuditCard";
import AuditAnalytics from "@/components/logs/AuditAnalytics";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import type { NormalizedAuditLog } from "@/types";

// ─── export helpers ───────────────────────────────────────────────────────────

function toMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === "object" && val !== null) {
    if ("toMillis" in val) return (val as { toMillis(): number }).toMillis();
    if ("seconds"  in val) return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function formatDateCell(val: unknown): string {
  const ms = toMs(val);
  if (!ms) return "";
  return new Date(ms).toLocaleString("ar-EG");
}

function escapeCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCsv(logs: NormalizedAuditLog[]) {
  const headers = ["التاريخ", "العملية", "الفئة", "الخطورة", "المنفذ", "الدور", "الهدف", "الوصف", "المبلغ (USD)", "المصدر"];
  const rows = logs.map((l) => [
    formatDateCell(l.createdAt),
    l.action,
    l.category ?? "",
    l.severity ?? "",
    l._performedByName,
    l._performedByRole,
    l._entityName,
    l._description,
    l.financialData?.amountUSD?.toFixed(2) ?? "",
    l.source ?? "",
  ].map(escapeCsv).join(","));

  const bom    = "﻿";
  const csv    = bom + [headers.join(","), ...rows].join("\n");
  const blob   = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson(logs: NormalizedAuditLog[]) {
  const data  = JSON.stringify(logs, null, 2);
  const blob  = new Blob([data], { type: "application/json" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href      = url;
  a.download  = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon, color, sub }: StatCardProps) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border-soft)",
      borderRadius: 16, boxShadow: "var(--shadow-card)",
      padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{value.toLocaleString("ar-EG")}</p>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── export menu ─────────────────────────────────────────────────────────────

function ExportMenu({ logs }: { logs: NormalizedAuditLog[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: "var(--surface)", border: "1px solid var(--border)",
          color: "var(--text-secondary)", fontFamily: "inherit", transition: "all .15s",
        }}
      >
        <Download size={13} />
        تصدير
        <ChevronDown size={12} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, boxShadow: "var(--shadow-panel)", padding: "4px 0",
          zIndex: 20, minWidth: 150,
        }}>
          {[
            { label: "CSV / Excel", fn: () => exportCsv(logs) },
            { label: "JSON",        fn: () => exportJson(logs) },
            { label: "طباعة / PDF", fn: () => window.print() },
          ].map(({ label, fn }) => (
            <button key={label}
              onClick={() => { fn(); setOpen(false); }}
              style={{
                width: "100%", textAlign: "right", padding: "8px 14px",
                fontSize: 13, color: "var(--text-secondary)",
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit", transition: "background .1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

type Tab = "timeline" | "analytics";

export default function LogsPage() {
  const { can } = useAuthStore();
  const {
    logs, grouped, allLogs,
    loading, loadingMore, hasMore, error,
    filters, setFilters,
    loadMore, stats,
  } = useAuditLogs();

  const [tab, setTab] = useState<Tab>("timeline");
  const [showFilters, setShowFilters] = useState(true);

  const canView = can("canViewLogs");

  const handleLoadMore = useCallback(() => loadMore(), [loadMore]);

  // ── access guard ──────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <ProtectedLayout>
        <div className="p-6 max-w-2xl mx-auto mt-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <ScrollText size={24} className="text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-700 mb-2">غير مصرح</h2>
          <p className="text-sm text-slate-400">سجل العمليات متاح للمالك والمديرين فقط</p>
        </div>
      </ProtectedLayout>
    );
  }

  // ── loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <RefreshCw size={28} className="text-slate-300 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل السجلات...</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <ProtectedLayout>
        <div className="p-6 text-center text-red-500">{error}</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5 print:p-0">

        {/* ── header ─────────────────────────────────────────────────────── */}
        <PageHeader
          title="سجل العمليات"
          subtitle={`${stats.total} عملية مسجلة · ${stats.today} اليوم`}
          actions={<ExportMenu logs={logs} />}
        />

        {/* ── stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
          <StatCard
            label="إجمالي السجلات"
            value={stats.total}
            icon={<ScrollText size={18} style={{ color: "#83A2DB" }} />}
            color=""
          />
          <StatCard
            label="اليوم"
            value={stats.today}
            icon={<Calendar size={18} style={{ color: "var(--jk-blue)" }} />}
            color=""
          />
          <StatCard
            label="أحداث حرجة"
            value={stats.critical}
            icon={<AlertTriangle size={18} style={{ color: "var(--jk-red)" }} />}
            color=""
          />
          <StatCard
            label="عمليات مالية"
            value={stats.financial}
            icon={<DollarSign size={18} style={{ color: "#83A2DB" }} />}
            color=""
          />
        </div>

        {/* ── tabs ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 rounded-xl p-1 w-fit print:hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border-soft)" }}>
          <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")}>
            <List size={14} /> الجدول الزمني
          </TabBtn>
          <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>
            <BarChart2 size={14} /> التحليلات
          </TabBtn>
        </div>

        {/* ── filters ────────────────────────────────────────────────────── */}
        <div className="print:hidden">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition mb-2"
          >
            <Activity size={14} />
            {showFilters ? "إخفاء الفلاتر" : "إظهار الفلاتر"}
          </button>
          {showFilters && (
            <AuditFilters
              filters={filters}
              onChange={setFilters}
              totalCount={allLogs.length}
              filteredCount={logs.length}
            />
          )}
        </div>

        {/* ── timeline tab ───────────────────────────────────────────────── */}
        {tab === "timeline" && (
          <div className="space-y-6">
            {logs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                <ScrollText size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">لا توجد سجلات تطابق الفلاتر</p>
              </div>
            ) : (
              <>
                {grouped.map((group) => (
                  <section key={group.label}>
                    {/* group header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-xs text-slate-400">{group.logs.length} سجل</span>
                    </div>

                    {/* cards */}
                    <div className="space-y-2">
                      {group.logs.map((log) => (
                        <AuditCard key={log.id} log={log} />
                      ))}
                    </div>
                  </section>
                ))}

                {/* load more */}
                {hasMore && (
                  <div className="text-center pt-2 print:hidden">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition shadow-sm disabled:opacity-60"
                    >
                      {loadingMore
                        ? <><RefreshCw size={14} className="animate-spin" /> جاري التحميل...</>
                        : <><ChevronDown size={14} /> تحميل المزيد</>
                      }
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── analytics tab ──────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <AuditAnalytics logs={allLogs} />
        )}
      </div>
    </ProtectedLayout>
  );
}

// ── tiny helper ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
      style={{
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        boxShadow: active ? "var(--shadow-card)" : "none",
      }}
    >
      {children}
    </button>
  );
}
