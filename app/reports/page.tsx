"use client";

import { useState } from "react";
import { formatNumber, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments }    from "@/hooks/usePayments";
import { useRefunds }     from "@/hooks/useRefunds";
import { useAuthStore }   from "@/store/authStore";
import {
  exportSubscribersCSV,
  exportPaymentsCSV,
  exportEmployeePerformanceCSV,
} from "@/lib/analytics/reports";
import { canExportReports, canViewFinancialReports } from "@/lib/permissionGuards";
import {
  Download, Users, CreditCard, Briefcase,
  Calendar, FileSpreadsheet, Lock, CheckCircle2, X,
  TrendingUp, ChevronLeft,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

interface ReportItem {
  key:         string;
  icon:        React.ReactNode;
  label:       string;
  description: string;
  color:       string;
  bg:          string;
  border:      string;
  stat:        string;
  statLabel:   string;
  formats:     string[];
  restricted?: boolean;
  onExport:    () => void;
}

export default function ReportsPage() {
  const router  = useRouter();
  const { user } = useAuthStore();
  const { loading } = useAuthStore();

  const { subscribers } = useSubscribers();
  const { payments }    = usePayments({});
  const { refunds }     = useRefunds({});

  const canExport  = canExportReports(user)       || user?.role === "owner" || user?.role === "admin";
  const canViewFin = canViewFinancialReports(user) || user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    if (!loading && user && !canExport && !canViewFin) router.replace("/");
  }, [user, loading, router, canExport, canViewFin]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const dateActive = !!(dateFrom || dateTo);

  const reports: ReportItem[] = [
    {
      key:         "subscribers",
      icon:        <Users size={22} />,
      label:       "تقرير المشتركين",
      description: "قائمة شاملة بجميع المشتركين مع حالة الاشتراك والبيانات المالية وتاريخ التسجيل",
      color:       "#5B5FEF",
      bg:          "rgba(91,95,239,0.08)",
      border:      "rgba(91,95,239,0.20)",
      stat:        `${subscribers.length}`,
      statLabel:   "مشترك",
      formats:     ["CSV", "Excel"],
      onExport:    () => exportSubscribersCSV(subscribers, { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    },
    {
      key:         "payments",
      icon:        <CreditCard size={22} />,
      label:       "تقرير المدفوعات",
      description: "جميع الدفعات والاستردادات مع العملات وطرق الدفع والإجماليات",
      color:       "#22C55E",
      bg:          "#ECFDF3",
      border:      "rgba(34,197,94,0.25)",
      stat:        `${payments.length}`,
      statLabel:   "دفعة",
      formats:     ["CSV", "Excel"],
      restricted:  !canViewFin,
      onExport:    () => exportPaymentsCSV(payments, refunds, dateFrom || undefined, dateTo || undefined),
    },
    {
      key:         "employees",
      icon:        <Briefcase size={22} />,
      label:       "أداء الموظفين",
      description: "مقارنة أداء كل موظف من حيث عدد المشتركين والإيراد المحقق",
      color:       "#F59E0B",
      bg:          "#FFFBEB",
      border:      "rgba(245,158,11,0.25)",
      stat:        `${new Set(subscribers.map(s => s.convincedBy).filter(Boolean)).size}`,
      statLabel:   "موظف نشط",
      formats:     ["CSV"],
      onExport:    () => exportEmployeePerformanceCSV(subscribers),
    },
  ];

  return (
    <ProtectedLayout>
      <div style={{ minHeight: "100%", background: "var(--page-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 48px" }}>

          <PageHeader title="التقارير" subtitle="تصدير البيانات والتقارير التفصيلية" />

          {/* ── Summary stats ─────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, margin: "24px 0" }}>
            {[
              { label: "إجمالي المشتركين", value: subscribers.length, color: "#5B5FEF", bg: "rgba(91,95,239,0.08)" },
              { label: "الدفعات",          value: payments.length,    color: "#22C55E", bg: "#ECFDF3" },
              { label: "الاستردادات",      value: refunds.length,     color: "#EF4444", bg: "#FEF2F2" },
              { label: "التقارير المتاحة", value: reports.filter(r => !r.restricted).length, color: "#F59E0B", bg: "#FFFBEB" },
            ].map((s) => (
              <div key={s.label} style={{
                background: "var(--surface)", border: "1px solid var(--border-light)",
                borderRadius: 16, padding: "14px 16px",
                boxShadow: "var(--shadow-card)",
              }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {formatNumber(s.value)}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Date filter ───────────────────────────────────────────────── */}
          <div style={{
            background: "var(--surface)",
            border: `1px solid ${dateActive ? "rgba(91,95,239,0.30)" : "var(--border-light)"}`,
            borderRadius: 18,
            padding: "16px 20px",
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
            marginBottom: 24,
            boxShadow: dateActive ? "0 0 0 3px rgba(91,95,239,0.08)" : "var(--shadow-card)",
            transition: "border-color .2s, box-shadow .2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: dateActive ? "rgba(91,95,239,0.10)" : "var(--surface-secondary)",
                border: `1px solid ${dateActive ? "rgba(91,95,239,0.22)" : "var(--border-light)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Calendar size={14} style={{ color: dateActive ? "#5B5FEF" : "var(--text-muted)" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: dateActive ? "#5B5FEF" : "var(--text-secondary)" }}>
                فلترة بالتاريخ
              </span>
              {dateActive && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#5B5FEF", color: "#fff" }}>
                  نشط
                </span>
              )}
            </div>

            {/*
              * The empty native date field shows its placeholder in the
              * BROWSER'S locale, so an English-language browser renders
              * "mm/dd/yyyy" in the middle of an Arabic page. That placeholder is
              * not settable from HTML or CSS in any browser — the only way to
              * remove it is to replace the control with a custom picker, which
              * costs the free calendar, the keyboard support and the mobile
              * date wheel. Not worth it.
              *
              * What IS fixable is the ambiguity: each field now says which end
              * of the range it is, and the chosen range is echoed underneath in
              * Arabic, so nobody has to interpret the placeholder to know what
              * they picked.
              */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }} htmlFor="rep-from">من</label>
              <input
                id="rep-from"
                type="date" value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                dir="ltr"
                style={{
                  flex: 1, padding: "8px 12px",
                  border: `1px solid ${dateFrom ? "#5B5FEF" : "var(--border-light)"}`,
                  borderRadius: 12, fontSize: 13,
                  background: dateFrom ? "rgba(91,95,239,0.05)" : "var(--surface-secondary)",
                  color: dateFrom ? "#5B5FEF" : "var(--text-secondary)",
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                }}
              />
              <ChevronLeft size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }} htmlFor="rep-to">إلى</label>
              <input
                id="rep-to"
                type="date" value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                dir="ltr"
                style={{
                  flex: 1, padding: "8px 12px",
                  border: `1px solid ${dateTo ? "#5B5FEF" : "var(--border-light)"}`,
                  borderRadius: 12, fontSize: 13,
                  background: dateTo ? "rgba(91,95,239,0.05)" : "var(--surface-secondary)",
                  color: dateTo ? "#5B5FEF" : "var(--text-secondary)",
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                }}
              />
            </div>

            {/* The range restated in Arabic — the answer to "what did I just pick". */}
            {(dateFrom || dateTo) && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
                {dateFrom && dateTo
                  ? formatDate(dateFrom) + " — " + formatDate(dateTo)
                  : dateFrom
                    ? "من " + formatDate(dateFrom)
                    : "حتى " + formatDate(dateTo)}
              </span>
            )}

            {dateActive && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600, color: "#EF4444",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)",
                  borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <X size={11} />
                مسح
              </button>
            )}
          </div>

          {/* ── Report cards ──────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {reports.map((r) => (
              <ReportCard
                key={r.key}
                report={r}
                canExport={canExport}
                dateFrom={dateFrom}
                dateTo={dateTo}
              />
            ))}
          </div>

          {/* ── Info box ──────────────────────────────────────────────────── */}
          <div style={{
            marginTop: 32, padding: "14px 18px",
            background: "rgba(91,95,239,0.04)",
            border: "1px solid rgba(91,95,239,0.15)",
            borderRadius: 16,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <TrendingUp size={15} style={{ color: "#5B5FEF", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#5B5FEF", margin: "0 0 2px" }}>
                نصيحة: استخدم فلترة التاريخ للحصول على تقارير دقيقة
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                حدد نطاقاً زمنياً لتصدير بيانات فترة معينة فقط. تدعم التقارير صيغة CSV المتوافقة مع Excel وجداول Google.
              </p>
            </div>
          </div>

        </div>
      </div>
    </ProtectedLayout>
  );
}

// ─── Report card component ────────────────────────────────────────────────────

function ReportCard({ report: r, canExport, dateFrom, dateTo }: {
  report: ReportItem;
  canExport: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [done,      setDone]      = useState(false);

  const disabled = r.restricted || !canExport;

  async function handleExport() {
    if (disabled) return;
    setExporting(true);
    try {
      await r.onExport();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setExporting(false);
    }
  }

  const hasDateFilter = !!(dateFrom || dateTo);

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid var(--border-light)`,
      borderRadius: 22,
      overflow: "hidden",
      boxShadow: "var(--shadow-card)",
      display: "flex", flexDirection: "column",
      opacity: disabled ? 0.65 : 1,
      transition: "box-shadow .2s, transform .2s",
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(15,23,42,0.10)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
      (e.currentTarget as HTMLElement).style.transform = "none";
    }}
    >
      {/* Card header — colored strip */}
      <div style={{
        padding: "20px 20px 16px",
        background: r.bg,
        borderBottom: `1px solid ${r.border}`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
      }}>
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: "rgba(255,255,255,0.70)",
          border: `1px solid ${r.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: r.color,
          boxShadow: `0 2px 8px ${r.border}`,
        }}>
          {r.icon}
        </div>

        {/* Stat pill */}
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: r.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {formatNumber(Number(r.stat))}
          </p>
          <p style={{ fontSize: 11, color: r.color, opacity: 0.7, fontWeight: 600, marginTop: 2 }}>{r.statLabel}</p>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "16px 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{r.label}</h3>
            {r.restricted && (
              <Lock size={13} style={{ color: "#EF4444", flexShrink: 0 }} />
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{r.description}</p>

          {r.restricted && (
            <p style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: "#EF4444", display: "flex", alignItems: "center", gap: 5 }}>
              <Lock size={11} />
              يتطلب صلاحية عرض البيانات المالية
            </p>
          )}
        </div>

        {/* Formats + date badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {r.formats.map(fmt => (
            <span key={fmt} style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
              background: "var(--surface-secondary)", border: "1px solid var(--border-light)",
              color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <FileSpreadsheet size={10} />
              {fmt}
            </span>
          ))}
          {hasDateFilter && !r.restricted && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
              background: "rgba(91,95,239,0.08)", border: "1px solid rgba(91,95,239,0.20)",
              color: "#5B5FEF",
            }}>
              {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `من ${dateFrom}` : `حتى ${dateTo}`}
            </span>
          )}
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={disabled || exporting}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 16px", borderRadius: 14,
            fontSize: 13, fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            border: "none",
            marginTop: "auto",
            transition: "all .2s",
            background: disabled
              ? "var(--surface-secondary)"
              : done
              ? "#22C55E"
              : r.color,
            color: disabled ? "var(--text-muted)" : "#fff",
            boxShadow: disabled ? "none" : `0 4px 14px ${r.color}40`,
          }}
        >
          {done ? (
            <><CheckCircle2 size={15} /> تم التصدير!</>
          ) : exporting ? (
            <><span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> جاري التصدير...</>
          ) : (
            <><Download size={15} /> تصدير CSV</>
          )}
        </button>
      </div>
    </div>
  );
}
