"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Search,
  X,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import {
  useUpdateLeadStatusMutation,
  useWhatsappLeadsAnalytics,
  useWhatsappLeadsMonthlyAnalytics,
  useWhatsappLeadsQuery,
} from "@/features/whatsapp-leads";
import { LeadStatus, type WhatsappLead } from "@/types/whatsapp-lead";

// ── Theme tokens ─────────────────────────────────────────────────────────────
const LIGHT = {
  bg:         "var(--page-bg)",
  card:       "#FFFFFF",
  cardBorder: "rgba(16,20,26,0.06)",
  cardShadow: "0 1px 2px rgba(16,20,26,.04), 0 8px 20px -8px rgba(16,20,26,.08)",
  textPri:    "#5B5FEF",
  textSec:    "#6B7280",
  textMut:    "#9CA3AF",
  row:        "rgba(16,20,26,0.02)",
  rowHover:   "rgba(16,20,26,0.04)",
  divider:    "rgba(16,20,26,0.06)",
  inputBg:    "#F8FAFC",
  inputBorder:"rgba(16,20,26,0.10)",
  grid:       "rgba(16,20,26,0.06)",
  tick:       "#9CA3AF",
};

const DARK = {
  bg:         "#070c18",
  card:       "rgba(255,255,255,0.035)",
  cardBorder: "rgba(255,255,255,0.07)",
  cardShadow: "none",
  textPri:    "#f1f5f9",
  textSec:    "#6b7280",
  textMut:    "#6B7280",
  row:        "rgba(255,255,255,0.02)",
  rowHover:   "rgba(255,255,255,0.05)",
  divider:    "rgba(255,255,255,0.07)",
  inputBg:    "rgba(255,255,255,0.05)",
  inputBorder:"rgba(255,255,255,0.10)",
  grid:       "rgba(255,255,255,0.04)",
  tick:       "#6B7280",
};

// ── Constants ─────────────────────────────────────────────────────────────────
const FLAGS: Record<string, string> = {
  SA: "🇸🇦", EG: "🇪🇬", JO: "🇯🇴",
  "PS-WB": "🇵🇸", "PS-GZ": "🇵🇸", AE: "🇦🇪", KW: "🇰🇼",
};

const COUNTRY_LABELS: Record<string, string> = {
  SA: "السعودية", EG: "مصر", JO: "الأردن",
  "PS-WB": "فلسطين - الضفة", "PS-GZ": "فلسطين - غزة",
  AE: "الإمارات", KW: "الكويت",
};

const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string; chart: string }> = {
  [LeadStatus.INTERESTED]:          { bg: "#5B5FEF", text: "#fff",     chart: "#5B5FEF" },
  [LeadStatus.READY_TO_PAY]:        { bg: "#5B5FEF", text: "#fff",     chart: "#5B5FEF" },
  [LeadStatus.IMPORTANT_FOLLOW_UP]: { bg: "#F59E0B", text: "#5B5FEF", chart: "#F59E0B" },
  [LeadStatus.NEW]:                 { bg: "#9CA3AF", text: "#fff",     chart: "#9CA3AF" },
  [LeadStatus.RETARGETING]:         { bg: "#A78BFA", text: "#fff",     chart: "#A78BFA" },
};

const ALL_STATUSES = Object.values(LeadStatus) as LeadStatus[];

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(ts: Timestamp): string {
  const diffMs = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ar-EG", {
    weekday: "short",
    year:    "numeric",
    month:   "short",
    day:     "numeric",
  });
}

function shiftDay(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

function whatsappUrl(phone: string): string {
  // Strip non-digits then build wa.me link
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LeadStatus }) {
  const { bg, text } = STATUS_COLORS[status];
  return (
    <span style={{
      background: bg, color: text,
      fontSize: 11, fontWeight: 600,
      padding: "3px 10px", borderRadius: 999,
      whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {status === LeadStatus.RETARGETING && <RotateCcw size={10} />}
      {status}
    </span>
  );
}

function SkeletonRows({ t }: { t: typeof LIGHT }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: `1px solid ${t.divider}` }}>
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} style={{ padding: "14px 16px" }}>
              <Skeleton className="h-4 rounded-lg" style={{ width: j === 3 ? 80 : j === 6 ? 60 : "80%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function StatCard({
  label, value, accent, sub, icon, t,
}: {
  label:   string;
  value:   number | undefined;
  accent:  string;
  sub?:    string;
  icon?:   React.ReactNode;
  t:       typeof LIGHT;
}) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.cardBorder}`,
      boxShadow: t.cardShadow, borderRadius: 16,
      padding: "16px 20px", minWidth: 120, flex: 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: 12, color: t.textSec }}>{label}</p>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${accent}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: accent,
          }}>
            {icon}
          </div>
        )}
      </div>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value ?? "—"}
      </p>
      {sub && <p style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Monthly chart ─────────────────────────────────────────────────────────────
function MonthlyChart({ referenceDate, t }: { referenceDate: Date; t: typeof LIGHT }) {
  const { data: monthData = [], isLoading } = useWhatsappLeadsMonthlyAnalytics(referenceDate);

  const chartData = monthData.map((d) => ({
    يوم:                       d.day,
    [LeadStatus.NEW]:              d.byStatus[LeadStatus.NEW]                 ?? 0,
    [LeadStatus.INTERESTED]:       d.byStatus[LeadStatus.INTERESTED]           ?? 0,
    [LeadStatus.READY_TO_PAY]:     d.byStatus[LeadStatus.READY_TO_PAY]         ?? 0,
    [LeadStatus.IMPORTANT_FOLLOW_UP]: d.byStatus[LeadStatus.IMPORTANT_FOLLOW_UP] ?? 0,
    [LeadStatus.RETARGETING]:      d.byStatus[LeadStatus.RETARGETING]           ?? 0,
  }));

  const monthName = referenceDate.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

  // Gradient id per status (safe for SVG ids)
  const gradId = (s: LeadStatus) =>
    `wl-grad-${s.replace(/\s/g, "-").replace(/[^\w-]/g, "")}`;

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.cardBorder}`,
      boxShadow: t.cardShadow, borderRadius: 16,
      padding: "20px 24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.textPri }}>إحصائيات الشهر</h2>
          <p style={{ fontSize: 12, color: t.textMut, marginTop: 2 }}>{monthName} — ليدز يومياً حسب الحالة</p>
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {ALL_STATUSES.map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="20" y2="5" stroke={STATUS_COLORS[s].chart} strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="5" r="3" fill={STATUS_COLORS[s].chart} />
              </svg>
              <span style={{ fontSize: 11, color: t.textSec }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMut, fontSize: 13 }}>
          لا توجد بيانات لهذا الشهر
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {ALL_STATUSES.map((s) => (
                <linearGradient key={s} id={gradId(s)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={STATUS_COLORS[s].chart} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={STATUS_COLORS[s].chart} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke={t.grid} vertical={false} />
            <XAxis
              dataKey="يوم"
              tick={{ fill: t.tick, fontSize: 11, fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: t.tick, fontSize: 11, fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={24}
            />
            <Tooltip
              contentStyle={{
                background: t.card,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 12,
                fontSize: 12,
                color: t.textPri,
                fontFamily: "inherit",
                boxShadow: "0 8px 24px rgba(0,0,0,.12)",
              }}
              itemStyle={{ color: t.textSec }}
              cursor={{ stroke: t.textMut, strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            {ALL_STATUSES.map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stroke={STATUS_COLORS[s].chart}
                strokeWidth={2}
                fill={`url(#${gradId(s)})`}
                dot={(props) => {
                  const { cx, cy, value } = props;
                  if (!value) return <g key={`dot-${cx}-${cy}`} />;
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#fff"
                      stroke={STATUS_COLORS[s].chart}
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6, fill: STATUS_COLORS[s].chart, stroke: "#fff", strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Lead Drawer ───────────────────────────────────────────────────────────────
function InfoRow({ label, value, t }: { label: string; value: React.ReactNode; t: typeof LIGHT }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: t.textMut, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: t.textPri, fontWeight: 500, textAlign: "left" }}>{value}</span>
    </div>
  );
}

function LeadDrawer({
  lead, t, onClose,
}: {
  lead: WhatsappLead;
  t:    typeof LIGHT;
  onClose: () => void;
}) {
  const mutation = useUpdateLeadStatusMutation();

  function handleStatus(status: LeadStatus) {
    mutation.mutate({ id: lead.id, status }, { onSuccess: onClose });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        style={{
          position: "fixed",
          insetInlineStart: 0, top: 0, bottom: 0,
          width: 340, zIndex: 50,
          background: t.card,
          borderInlineEnd: `1px solid ${t.cardBorder}`,
          display: "flex", flexDirection: "column",
          padding: 24, gap: 18, overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: t.textPri }}>تفاصيل الليد</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "transparent", border: `1px solid ${t.cardBorder}`,
            color: t.textSec, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={14} />
          </button>
        </div>

        {/* WhatsApp CTA */}
        <a
          href={whatsappUrl(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 16px", borderRadius: 12,
            background: "#25D366", color: "#fff",
            fontWeight: 600, fontSize: 14,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(37,211,102,.30)",
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          <MessageCircle size={17} />
          فتح محادثة واتساب
          <ExternalLink size={13} style={{ opacity: 0.7 }} />
        </a>

        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <InfoRow label="الرقم"     value={<code style={{ fontSize: 12 }}>{lead.phone}</code>} t={t} />
          {lead.name && <InfoRow label="الاسم"  value={lead.name} t={t} />}
          <InfoRow
            label="البلد"
            value={`${FLAGS[lead.country] ?? ""} ${COUNTRY_LABELS[lead.country] ?? lead.country}`}
            t={t}
          />
          <InfoRow label="الحالة"      value={<StatusBadge status={lead.status} />} t={t} />
          <InfoRow label="أول رسالة"   value={relativeTime(lead.firstMessageAt)} t={t} />
          <InfoRow label="آخر رسالة"   value={relativeTime(lead.lastMessageAt)} t={t} />
          {lead.assignedTo && (
            <InfoRow label="المسؤول" value={lead.assignedTo.replace("uid_", "")} t={t} />
          )}
        </div>

        {/* Last message */}
        <div style={{
          background: t.row, border: `1px solid ${t.cardBorder}`,
          borderRadius: 12, padding: 14, fontSize: 13, color: t.textSec,
        }}>
          <p style={{ fontSize: 11, color: t.textMut, marginBottom: 6 }}>آخر رسالة</p>
          <p>{lead.lastMessagePreview}</p>
        </div>

        {/* Status change */}
        <div>
          <p style={{ fontSize: 12, color: t.textMut, marginBottom: 10 }}>تغيير الحالة</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {ALL_STATUSES.map((s) => {
              const active = lead.status === s;
              const { bg, text } = STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  disabled={mutation.isPending}
                  style={{
                    padding: "9px 14px", borderRadius: 10,
                    border: active ? "none" : `1px solid ${t.cardBorder}`,
                    background: active ? bg : "transparent",
                    color: active ? text : t.textSec,
                    fontWeight: active ? 600 : 400, fontSize: 13,
                    cursor: mutation.isPending ? "not-allowed" : "pointer",
                    textAlign: "right",
                    transition: "all .12s ease",
                    opacity: mutation.isPending ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {s === LeadStatus.RETARGETING && <RotateCcw size={13} />}
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </motion.aside>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WhatsappLeadsPage() {
  const t = LIGHT;

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [statusFilter, setStatusFilter]   = useState<LeadStatus | "all">("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [search, setSearch]               = useState("");
  const [drawerLead, setDrawerLead]       = useState<WhatsappLead | null>(null);

  const { data: rawLeads = [], isLoading } = useWhatsappLeadsQuery(selectedDate);
  const { data: analytics }               = useWhatsappLeadsAnalytics(selectedDate);

  // Client-side filtering
  const leads = useMemo(() => {
    let result = rawLeads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (countryFilter)          result = result.filter((l) => l.country === countryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) => l.phone.includes(q) || (l.name?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [rawLeads, statusFilter, countryFilter, search]);

  const availableCountries = useMemo(
    () => [...new Set(rawLeads.map((l) => l.country))],
    [rawLeads],
  );

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  function prevDay() { setSelectedDate((d) => shiftDay(d, -1)); }
  function nextDay() { setSelectedDate((d) => shiftDay(d, +1)); }

  return (
    <ProtectedLayout>
      <div style={{ background: t.bg, minHeight: "100%" }}>
        <div
          className="mx-auto max-w-screen-2xl p-5 md:p-7"
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* ── Header ── */}
          <PageHeader
            title="واتساب ليدز"
            subtitle={analytics ? `${analytics.total} ليد · ${analytics.newToday} جديد اليوم` : undefined}
            actions={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={prevDay} style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: t.card, border: `1px solid ${t.cardBorder}`,
                  color: t.textSec, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ChevronRight size={16} />
                </button>
                <div style={{ textAlign: "center", minWidth: 120 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: t.textPri }}>
                    {isToday ? "اليوم" : formatDate(selectedDate)}
                  </p>
                  {isToday && (
                    <p style={{ fontSize: 11, color: t.textMut }}>{formatDate(selectedDate)}</p>
                  )}
                </div>
                <button onClick={nextDay} disabled={isToday} style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: t.card, border: `1px solid ${t.cardBorder}`,
                  color: isToday ? t.textMut : t.textSec,
                  cursor: isToday ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: isToday ? 0.4 : 1,
                }}>
                  <ChevronLeft size={16} />
                </button>
              </div>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ── Stat cards ── */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <StatCard
                label="إجمالي الليدز"
                value={analytics?.total}
                accent={t.textPri}
                sub={analytics ? `${analytics.newToday} جديد اليوم` : undefined}
                icon={<MessageSquare size={14} />}
                t={t}
              />
              <StatCard
                label="رسائل اليوم"
                value={analytics?.totalMessages}
                accent="#5B5FEF"
                sub="إجمالي المحادثات النشطة"
                icon={<MessageCircle size={14} />}
                t={t}
              />
              <StatCard
                label="مهتم"
                value={analytics?.byStatus[LeadStatus.INTERESTED]}
                accent="#5B5FEF"
                t={t}
              />
              <StatCard
                label="جاهز للدفع"
                value={analytics?.byStatus[LeadStatus.READY_TO_PAY]}
                accent="#5B5FEF"
                t={t}
              />
              <StatCard
                label="متابعة هامة"
                value={analytics?.byStatus[LeadStatus.IMPORTANT_FOLLOW_UP]}
                accent="#F59E0B"
                t={t}
              />
              <StatCard
                label="إعادة استهداف"
                value={analytics?.byStatus[LeadStatus.RETARGETING]}
                accent="#A78BFA"
                icon={<RotateCcw size={14} />}
                t={t}
              />
            </div>
          </div>

          {/* ── Monthly chart ── */}
          <MonthlyChart referenceDate={selectedDate} t={t} />

          {/* ── Filter bar ── */}
          <div style={{
            background: t.card, border: `1px solid ${t.cardBorder}`,
            boxShadow: t.cardShadow, borderRadius: 16,
            padding: "14px 18px",
            display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
          }}>
            {/* Status pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all", ...ALL_STATUSES] as const).map((s) => {
                const active = statusFilter === s;
                const label = s === "all" ? "الكل" : s;
                const { bg, text } = s !== "all"
                  ? STATUS_COLORS[s]
                  : { bg: t.textPri, text: "#fff" };
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s as LeadStatus | "all")}
                    style={{
                      padding: "5px 14px", borderRadius: 999,
                      border: active ? "none" : `1px solid ${t.cardBorder}`,
                      background: active ? bg : "transparent",
                      color: active ? text : t.textSec,
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      cursor: "pointer", transition: "all .12s ease",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    {s === LeadStatus.RETARGETING && <RotateCcw size={10} />}
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1 }} />

            {/* Country dropdown */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{
                padding: "6px 12px", borderRadius: 10,
                border: `1px solid ${t.inputBorder}`,
                background: t.inputBg, color: t.textPri,
                fontSize: 13, cursor: "pointer", outline: "none",
              }}
            >
              <option value="">كل الدول</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>
                  {FLAGS[c] ?? ""} {COUNTRY_LABELS[c] ?? c}
                </option>
              ))}
            </select>

            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={13} style={{
                position: "absolute", top: "50%",
                insetInlineEnd: 10, transform: "translateY(-50%)",
                color: t.textMut, pointerEvents: "none",
              }} />
              <input
                type="text"
                placeholder="بحث باسم أو رقم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  paddingInlineEnd: 32, paddingInlineStart: 12,
                  paddingTop: 6, paddingBottom: 6,
                  borderRadius: 10, border: `1px solid ${t.inputBorder}`,
                  background: t.inputBg, color: t.textPri,
                  fontSize: 13, outline: "none", width: 200,
                }}
              />
            </div>
          </div>

          {/* ── Table ── */}
          <div style={{
            background: t.card, border: `1px solid ${t.cardBorder}`,
            boxShadow: t.cardShadow, borderRadius: 16, overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                    {["الرقم", "الاسم", "البلد", "الحالة", "آخر رسالة", "الوقت", "المسؤول"].map((h) => (
                      <th key={h} style={{
                        padding: "12px 16px", textAlign: "right",
                        fontWeight: 600, fontSize: 12, color: t.textMut, whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows t={t} />
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div style={{
                          padding: "60px 20px", textAlign: "center", color: t.textMut,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: 12,
                        }}>
                          <MessageSquare size={36} style={{ opacity: 0.25 }} />
                          <p style={{ fontSize: 14 }}>لا توجد ليدز لهذا اليوم</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead, idx) => (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.025 }}
                        onClick={() => setDrawerLead(lead)}
                        style={{
                          borderBottom: `1px solid ${t.divider}`,
                          cursor: "pointer",
                          transition: "background .1s ease",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        {/* Phone — with WhatsApp link button */}
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12, color: t.textPri }}>
                              {lead.phone}
                            </span>
                            <a
                              href={whatsappUrl(lead.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="فتح واتساب"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: "#25D36615",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#25D366", textDecoration: "none",
                                flexShrink: 0,
                                transition: "background .12s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#25D36625"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#25D36615"; }}
                            >
                              <MessageCircle size={13} />
                            </a>
                          </div>
                        </td>

                        <td style={{ padding: "13px 16px", color: t.textSec }}>
                          {lead.name ?? <span style={{ color: t.textMut }}>—</span>}
                        </td>

                        <td style={{ padding: "13px 16px", color: t.textSec, whiteSpace: "nowrap" }}>
                          {FLAGS[lead.country] ?? ""} {COUNTRY_LABELS[lead.country] ?? lead.country}
                        </td>

                        <td style={{ padding: "13px 16px" }}>
                          <StatusBadge status={lead.status} />
                        </td>

                        <td style={{
                          padding: "13px 16px", color: t.textSec,
                          maxWidth: 200, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {lead.lastMessagePreview}
                        </td>

                        <td style={{ padding: "13px 16px", color: t.textMut, whiteSpace: "nowrap", fontSize: 12 }}>
                          {relativeTime(lead.lastMessageAt)}
                        </td>

                        <td style={{ padding: "13px 16px", color: t.textSec, fontSize: 12 }}>
                          {lead.assignedTo
                            ? lead.assignedTo.replace("uid_", "")
                            : <span style={{ color: t.textMut }}>—</span>
                          }
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Drawer ── */}
      <AnimatePresence>
        {drawerLead && (
          <LeadDrawer
            lead={drawerLead}
            t={t}
            onClose={() => setDrawerLead(null)}
          />
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
