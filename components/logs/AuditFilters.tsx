"use client";

import { SlidersHorizontal, X, Search } from "lucide-react";
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

const CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "subscriber", label: "المشتركون" },
  { value: "financial",  label: "المالية" },
  { value: "user",       label: "المستخدمون" },
  { value: "auth",       label: "الأمان" },
  { value: "system",     label: "النظام" },
];

const SEVERITIES: { value: AuditSeverity; label: string; cls: string }[] = [
  { value: "success",  label: "ناجح",    cls: "bg-emerald-100 text-emerald-700" },
  { value: "info",     label: "معلومة",  cls: "bg-blue-100    text-blue-700" },
  { value: "warning",  label: "تحذير",   cls: "bg-amber-100   text-amber-700" },
  { value: "critical", label: "حرج",     cls: "bg-red-100     text-red-700" },
];

const SOURCES = [
  { value: "dashboard", label: "لوحة التحكم" },
  { value: "system",    label: "النظام" },
  { value: "api",       label: "API" },
];

function sel(cls: string) {
  return `${cls} border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 transition`;
}

function hasActiveFilters(f: AuditLogFilters): boolean {
  return !!(f.action || f.category || f.severity || f.source || f.dateFrom || f.dateTo || f.search);
}

export default function AuditFilters({ filters, onChange, totalCount, filteredCount }: AuditFiltersProps) {
  const active = hasActiveFilters(filters);

  function set<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({});
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
      {/* header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">فلترة السجلات</span>
          {active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              نشط
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {filteredCount === totalCount
              ? `${totalCount} سجل`
              : `${filteredCount} من ${totalCount}`}
          </span>
          {active && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition font-medium"
            >
              <X size={12} />
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="بحث في السجلات..."
          value={filters.search ?? ""}
          onChange={(e) => set("search", e.target.value || undefined)}
          className="w-full border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 transition placeholder:text-slate-400"
          dir="rtl"
        />
      </div>

      {/* filter row */}
      <div className="flex flex-wrap gap-2">
        {/* action */}
        <select
          value={filters.action ?? ""}
          onChange={(e) => set("action", e.target.value || undefined)}
          className={sel("text-slate-600")}
        >
          <option value="">كل العمليات</option>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        {/* category */}
        <select
          value={filters.category ?? ""}
          onChange={(e) => set("category", (e.target.value as AuditCategory) || undefined)}
          className={sel("text-slate-600")}
        >
          <option value="">كل الفئات</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* severity */}
        <select
          value={filters.severity ?? ""}
          onChange={(e) => set("severity", (e.target.value as AuditSeverity) || undefined)}
          className={sel("text-slate-600")}
        >
          <option value="">كل مستويات الخطورة</option>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* source */}
        <select
          value={filters.source ?? ""}
          onChange={(e) => set("source", (e.target.value as "dashboard" | "system" | "api") || undefined)}
          className={sel("text-slate-600")}
        >
          <option value="">كل المصادر</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* date from */}
        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => set("dateFrom", e.target.value || undefined)}
          className={sel("text-slate-600")}
          title="من تاريخ"
        />

        {/* date to */}
        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => set("dateTo", e.target.value || undefined)}
          className={sel("text-slate-600")}
          title="إلى تاريخ"
        />
      </div>

      {/* active filter chips */}
      {active && (
        <div className="flex flex-wrap gap-1.5">
          {filters.action && (
            <Chip label={`العملية: ${filters.action}`} onRemove={() => set("action", undefined)} />
          )}
          {filters.category && (
            <Chip label={`الفئة: ${filters.category}`} onRemove={() => set("category", undefined)} />
          )}
          {filters.severity && (
            <Chip label={`الخطورة: ${filters.severity}`} onRemove={() => set("severity", undefined)} />
          )}
          {filters.source && (
            <Chip label={`المصدر: ${filters.source}`} onRemove={() => set("source", undefined)} />
          )}
          {filters.dateFrom && (
            <Chip label={`من: ${filters.dateFrom}`} onRemove={() => set("dateFrom", undefined)} />
          )}
          {filters.dateTo && (
            <Chip label={`إلى: ${filters.dateTo}`} onRemove={() => set("dateTo", undefined)} />
          )}
          {filters.search && (
            <Chip label={`بحث: ${filters.search}`} onRemove={() => set("search", undefined)} />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 transition">
        <X size={10} />
      </button>
    </span>
  );
}
