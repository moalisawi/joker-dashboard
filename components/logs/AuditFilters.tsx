"use client";

import { SlidersHorizontal, X, Search, Calendar } from "lucide-react";
import type { AuditLogFilters, AuditCategory, AuditSeverity } from "@/types";

interface AuditFiltersProps {
  filters: AuditLogFilters;
  onChange: (f: AuditLogFilters) => void;
  totalCount: number;
  filteredCount: number;
}

const ACTIONS = [
  { value: "subscriber_created",   label: "إضافة مشترك" },
  { value: "subscriber_updated",   label: "تعديل مشترك" },
  { value: "subscriber_renewed",   label: "تجديد اشتراك" },
  { value: "subscriber_frozen",    label: "تجميد اشتراك" },
  { value: "subscriber_resumed",   label: "استئناف اشتراك" },
  { value: "subscriber_withdrawn", label: "انسحاب مشترك" },
  { value: "subscriber_deleted",   label: "حذف مشترك" },
  { value: "payment_created",      label: "دفعة جديدة" },
  { value: "refund_created",       label: "استرداد مالي" },
  { value: "user_created",         label: "إنشاء مستخدم" },
  { value: "user_updated",         label: "تعديل مستخدم" },
  { value: "role_changed",         label: "تغيير دور" },
  { value: "permissions_changed",  label: "تعديل صلاحيات" },
  { value: "account_activated",    label: "تفعيل حساب" },
  { value: "account_suspended",    label: "تعليق حساب" },
  { value: "login_success",        label: "تسجيل دخول" },
  { value: "login_failed",         label: "فشل دخول" },
  { value: "logout",               label: "تسجيل خروج" },
  { value: "analytics_exported",   label: "تصدير التحليلات" },
  { value: "settings_updated",     label: "تعديل الإعدادات" },
  { value: "data_exported",        label: "تصدير بيانات" },
];

const CATEGORIES: { value: AuditCategory; label: string; icon: string }[] = [
  { value: "subscriber", label: "مشتركون", icon: "👤" },
  { value: "financial",  label: "مالية",   icon: "💰" },
  { value: "user",       label: "مستخدمون",icon: "👥" },
  { value: "auth",       label: "أمان",    icon: "🔒" },
  { value: "system",     label: "نظام",    icon: "⚙️" },
];

const SEVERITIES: { value: AuditSeverity; label: string; color: string; bg: string; border: string }[] = [
  { value: "success",  label: "ناجح",   color: "#22C55E", bg: "#ECFDF3", border: "rgba(34,197,94,0.30)"  },
  { value: "info",     label: "معلومة", color: "#3B82F6", bg: "#EFF6FF", border: "rgba(59,130,246,0.30)" },
  { value: "warning",  label: "تحذير",  color: "#F59E0B", bg: "#FFFBEB", border: "rgba(245,158,11,0.30)" },
  { value: "critical", label: "حرج",    color: "#EF4444", bg: "#FEF2F2", border: "rgba(239,68,68,0.30)"  },
];

const SOURCES = [
  { value: "dashboard", label: "لوحة التحكم", icon: "🖥️" },
  { value: "system",    label: "النظام",      icon: "⚙️" },
  { value: "api",       label: "API",         icon: "🔌" },
];

function hasActiveFilters(f: AuditLogFilters): boolean {
  return !!(f.action || f.category || f.severity || f.source || f.dateFrom || f.dateTo || f.search);
}

// ─── Pill toggle button ───────────────────────────────────────────────────────

function PillBtn({
  active, onClick, children, activeColor, activeBg, activeBorder,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  activeBg?: string;
  activeBorder?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 12px", borderRadius: 999,
        fontSize: 12, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
        whiteSpace: "nowrap",
        transition: "all .15s",
        background: active ? (activeBg ?? "rgba(91,95,239,0.10)") : "transparent",
        color: active ? (activeColor ?? "#5B5FEF") : "var(--text-secondary)",
        border: `1px solid ${active ? (activeBorder ?? "rgba(91,95,239,0.25)") : "var(--border-light)"}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuditFilters({ filters, onChange, totalCount, filteredCount }: AuditFiltersProps) {
  const active = hasActiveFilters(filters);

  function set<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggle<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    onChange({ ...filters, [key]: filters[key] === value ? undefined : value });
  }

  function reset() { onChange({}); }

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border-light)",
      borderRadius: 20,
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--surface-secondary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "rgba(91,95,239,0.10)", border: "1px solid rgba(91,95,239,0.20)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <SlidersHorizontal size={14} style={{ color: "#5B5FEF" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>الفلاتر</span>
          {active && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
              background: "#5B5FEF", color: "#fff",
            }}>
              نشطة
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {filteredCount === totalCount
              ? `${totalCount} سجل`
              : <><strong style={{ color: "var(--text-primary)" }}>{filteredCount}</strong> من {totalCount}</>}
          </span>
          {active && (
            <button
              onClick={reset}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600, color: "#EF4444",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)",
                borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <X size={11} />
              مسح الكل
            </button>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Search */}
        <div>
          <FilterLabel>البحث</FilterLabel>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)", pointerEvents: "none",
            }} />
            <input
              type="text"
              placeholder="بحث في العمليات، المنفذ، الهدف..."
              value={filters.search ?? ""}
              onChange={(e) => set("search", e.target.value || undefined)}
              dir="rtl"
              style={{
                width: "100%", paddingRight: 36, paddingLeft: filters.search ? 36 : 14,
                paddingTop: 9, paddingBottom: 9,
                border: "1px solid var(--border-light)",
                borderRadius: 12, fontSize: 13,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color .15s, box-shadow .15s",
              }}
              onFocus={e => {
                e.target.style.borderColor = "#5B5FEF";
                e.target.style.boxShadow = "0 0 0 3px rgba(91,95,239,0.12)";
              }}
              onBlur={e => {
                e.target.style.borderColor = "var(--border-light)";
                e.target.style.boxShadow = "none";
              }}
            />
            {filters.search && (
              <button
                onClick={() => set("search", undefined)}
                style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div>
          <FilterLabel>الفئة</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIES.map((c) => (
              <PillBtn
                key={c.value}
                active={filters.category === c.value}
                onClick={() => toggle("category", c.value)}
              >
                <span>{c.icon}</span>
                {c.label}
              </PillBtn>
            ))}
          </div>
        </div>

        {/* Severity pills */}
        <div>
          <FilterLabel>مستوى الخطورة</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SEVERITIES.map((s) => (
              <PillBtn
                key={s.value}
                active={filters.severity === s.value}
                onClick={() => toggle("severity", s.value)}
                activeColor={s.color}
                activeBg={s.bg}
                activeBorder={s.border}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: filters.severity === s.value ? s.color : "var(--text-muted)",
                  display: "inline-block", flexShrink: 0,
                }} />
                {s.label}
              </PillBtn>
            ))}
          </div>
        </div>

        {/* Source pills */}
        <div>
          <FilterLabel>المصدر</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SOURCES.map((s) => (
              <PillBtn
                key={s.value}
                active={filters.source === s.value}
                onClick={() => toggle("source", s.value as "dashboard" | "system" | "api")}
              >
                <span>{s.icon}</span>
                {s.label}
              </PillBtn>
            ))}
          </div>
        </div>

        {/* Action + Date row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {/* Action select */}
          <div style={{ flex: "1 1 200px" }}>
            <FilterLabel>نوع العملية</FilterLabel>
            <div style={{ position: "relative" }}>
              <select
                value={filters.action ?? ""}
                onChange={(e) => set("action", e.target.value || undefined)}
                style={{
                  width: "100%", padding: "8px 12px",
                  border: `1px solid ${filters.action ? "#5B5FEF" : "var(--border-light)"}`,
                  borderRadius: 12, fontSize: 13,
                  background: filters.action ? "rgba(91,95,239,0.06)" : "var(--surface-secondary)",
                  color: filters.action ? "#5B5FEF" : "var(--text-secondary)",
                  outline: "none", cursor: "pointer",
                  fontFamily: "inherit", appearance: "none",
                  WebkitAppearance: "none",
                  paddingLeft: 32,
                }}
              >
                <option value="">كل العمليات</option>
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              {filters.action && (
                <button
                  onClick={() => set("action", undefined)}
                  style={{
                    position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#5B5FEF", padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Date range */}
          <div style={{ flex: "1 1 260px" }}>
            <FilterLabel>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={11} />
                نطاق التاريخ
              </span>
            </FilterLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => set("dateFrom", e.target.value || undefined)}
                title="من تاريخ"
                style={{
                  flex: 1, padding: "8px 10px",
                  border: `1px solid ${filters.dateFrom ? "#5B5FEF" : "var(--border-light)"}`,
                  borderRadius: 12, fontSize: 12,
                  background: filters.dateFrom ? "rgba(91,95,239,0.06)" : "var(--surface-secondary)",
                  color: filters.dateFrom ? "#5B5FEF" : "var(--text-secondary)",
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                }}
              />
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => set("dateTo", e.target.value || undefined)}
                title="إلى تاريخ"
                style={{
                  flex: 1, padding: "8px 10px",
                  border: `1px solid ${filters.dateTo ? "#5B5FEF" : "var(--border-light)"}`,
                  borderRadius: 12, fontSize: 12,
                  background: filters.dateTo ? "rgba(91,95,239,0.06)" : "var(--surface-secondary)",
                  color: filters.dateTo ? "#5B5FEF" : "var(--text-secondary)",
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                }}
              />
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {active && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4, borderTop: "1px solid var(--border-soft)" }}>
            {filters.action && (
              <Chip label={`${ACTIONS.find(a => a.value === filters.action)?.label ?? filters.action}`} onRemove={() => set("action", undefined)} />
            )}
            {filters.category && (
              <Chip label={`${CATEGORIES.find(c => c.value === filters.category)?.label ?? filters.category}`} onRemove={() => set("category", undefined)} />
            )}
            {filters.severity && (
              <Chip label={`${SEVERITIES.find(s => s.value === filters.severity)?.label ?? filters.severity}`} onRemove={() => set("severity", undefined)} color={SEVERITIES.find(s => s.value === filters.severity)?.color} />
            )}
            {filters.source && (
              <Chip label={`${SOURCES.find(s => s.value === filters.source)?.label ?? filters.source}`} onRemove={() => set("source", undefined)} />
            )}
            {filters.dateFrom && (
              <Chip label={`من: ${filters.dateFrom}`} onRemove={() => set("dateFrom", undefined)} />
            )}
            {filters.dateTo && (
              <Chip label={`إلى: ${filters.dateTo}`} onRemove={() => set("dateTo", undefined)} />
            )}
            {filters.search && (
              <Chip label={`"${filters.search}"`} onRemove={() => set("search", undefined)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, onRemove, color }: { label: string; onRemove: () => void; color?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 12, fontWeight: 600,
      padding: "3px 10px 3px 6px", borderRadius: 999,
      background: color ? `${color}18` : "rgba(91,95,239,0.08)",
      color: color ?? "#5B5FEF",
      border: `1px solid ${color ? `${color}30` : "rgba(91,95,239,0.20)"}`,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "inherit", opacity: 0.7 }}
      >
        <X size={10} />
      </button>
    </span>
  );
}
