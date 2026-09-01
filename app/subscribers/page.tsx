"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Download, SlidersHorizontal, Eye, Pencil, RotateCcw,
  CreditCard, Snowflake, PauseCircle, Play, UserMinus,  Trash2,
  MoreHorizontal, MessageCircle, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown, X, Plus, Users} from "lucide-react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { useActiveEmployees } from "@/features/users/hooks";
import { formatDate, formatNumber, getWhatsAppLink } from "@/lib/utils";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { toast } from "@/lib/toast";
import SubscriberModal from "@/components/subscribers/SubscriberModal";
import RenewalModal from "@/components/subscribers/RenewalModal";
import PaymentModal from "@/components/subscribers/PaymentModal";
import ProfileModal from "@/components/subscribers/ProfileModal";
import WithdrawModal from "@/components/subscribers/WithdrawModal";
import PauseModal from "@/components/subscribers/PauseModal";
import FreezeModal from "@/components/subscribers/FreezeModal";
import ResumeModal from "@/components/subscribers/ResumeModal";
import SubscriberNameChip from "@/components/subscribers/SubscriberNameChip";
import EmployeeNameChip from "@/components/employees/EmployeeNameChip";
import SubscriberDrawer from "@/components/subscribers/SubscriberDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Subscriber } from "@/types";

// ── Status types & config ──────────────────────────────────────────────────────
type StatusKey = "الكل" | "نشط" | "ينتهي قريباً" | "منتهي" | "موقوف" | "متجمد" | "منسحب";
type ModalType = "profile" | "create" | "edit" | "renew" | "payment" | "withdraw" | "pause" | "freeze" | "resume" | null;
type SortField = "name" | "daysRemaining" | "netAmountUSD" | "expiryDate" | "date" | null;
type SortDir = "asc" | "desc";

interface StatusMeta { color: string; bg: string; border: string; glow: string }
const STATUS_META: Record<Exclude<StatusKey, "الكل">, StatusMeta> = {
  "نشط":           { color: "#22C55E", bg: "#ECFDF3",  border: "rgba(34,197,94,0.25)",   glow: "rgba(34,197,94,0.15)"   },
  "ينتهي قريباً":  { color: "#F59E0B", bg: "#FFFBEB",  border: "rgba(245,158,11,0.25)",  glow: "rgba(245,158,11,0.15)"  },
  "منتهي":         { color: "#EF4444", bg: "#FEF2F2",  border: "rgba(239,68,68,0.25)",   glow: "rgba(239,68,68,0.15)"   },
  "موقوف":         { color: "#F59E0B", bg: "#FFFBEB",  border: "rgba(245,158,11,0.25)",  glow: "rgba(245,158,11,0.15)"  },
  "متجمد":         { color: "#3B82F6", bg: "#EFF6FF",  border: "rgba(59,130,246,0.25)",  glow: "rgba(59,130,246,0.15)"  },
  "منسحب":         { color: "#9CA3AF", bg: "#F1F5F9",  border: "rgba(156,163,175,0.25)", glow: "rgba(156,163,175,0.1)"  },
};

function getDisplayStatus(s: Subscriber): Exclude<StatusKey, "الكل"> {
  if (s.freezeData?.isFrozen)             return "متجمد";
  if (s.subscriptionStatus === "paused")  return "موقوف";
  if (s.subscriptionState === "withdrawn") return "منسحب";
  return (s.status as Exclude<StatusKey, "الكل">) ?? "نشط";
}

const AVATAR_PALETTE = ["#5B5FEF","#8B5CF6","#06B6D4","#22C55E","#EF4444","#F59E0B","#EC4899","#14B8A6"];
function avatarColor(name: string) { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string) { return (name || "؟").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase(); }

// ── Sub-components ─────────────────────────────────────────────────────────────

function PremiumAvatar({ name, status }: { name: string; status: Exclude<StatusKey,"الكل"> }) {
  const color = avatarColor(name);
  const dotColor = STATUS_META[status]?.color ?? "#9CA3AF";
  const pulse = status === "نشط" || status === "ينتهي قريباً";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: `linear-gradient(135deg, ${color}dd, ${color}88)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.02em",
        boxShadow: `0 4px 12px ${color}33`,
      }}>
        {avatarInitials(name)}
      </div>
      <span style={{
        position: "absolute", bottom: 0, insetInlineEnd: 0,
        width: 10, height: 10, borderRadius: "50%",
        background: dotColor, border: "2px solid #fff",
        animation: pulse ? "pulse-dot 1.8s ease-in-out infinite" : undefined,
      }} />
    </div>
  );
}

function PremiumStatusBadge({ status }: { status: Exclude<StatusKey,"الكل"> }) {
  const m = STATUS_META[status];
  const pulse = status === "نشط";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 11px", borderRadius: 999,
      background: m.bg, color: m.color,
      border: `1px solid ${m.border}`,
      fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
      boxShadow: `0 2px 8px ${m.glow}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: m.color, flexShrink: 0,
        animation: pulse ? "pulse-dot 1.8s ease-in-out infinite" : undefined,
      }} />
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 185px",
      gap: 0, padding: "14px 20px", borderBottom: "1px solid var(--jk-divider)",
      alignItems: "center",
    }}>
      {[180, 80, 90, 70, 80, 70, 60].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 36 : 16, width: w, borderRadius: 8,
          background: "linear-gradient(90deg, #F1F5F9 25%, #E8EDF5 50%, #F1F5F9 75%)",
          backgroundSize: "400% 100%",
          animation: "shimmer 1.4s ease-in-out infinite",
          animationDelay: `${i * 0.07}s`,
        }} />
      ))}
    </div>
  );
}

function DaysCell({ s, isFrozen, isPaused, isWithdrawn }: { s: Subscriber; isFrozen: boolean; isPaused: boolean; isWithdrawn: boolean }) {
  if (isPaused || isFrozen || isWithdrawn) return <span style={{ color: "var(--jk-subtle)" }}>—</span>;
  if (s.daysRemaining < 0) return <span style={{ color: "#EF4444", fontWeight: 700 }}>متأخر {Math.abs(s.daysRemaining)}ي</span>;
  if (s.daysRemaining <= 7) return <span style={{ color: "#F59E0B", fontWeight: 700 }}>{s.daysRemaining} يوم</span>;
  return <span style={{ color: "var(--jk-text)", fontWeight: 600 }}>{s.daysRemaining} يوم</span>;
}

// ── Action dropdown ─────────────────────────────────────────────────────────────
function QuickAction({ label, icon, color, onClick }: {
  label: string; icon: React.ReactNode; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      aria-label={label}
      style={{
        display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 9px",
        borderRadius: 8, border: "1px solid var(--jk-divider)", background: "transparent",
        color: "var(--jk-subtle)", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
        whiteSpace: "nowrap", transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}14`;
        e.currentTarget.style.borderColor = `${color}55`;
        e.currentTarget.style.color = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "var(--jk-divider)";
        e.currentTarget.style.color = "var(--jk-subtle)";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionMenu({
  s, canEdit, canWithdraw, canDelete,
  onProfile, onEdit, onRenew, onPayment, onFreeze, onResume, onPause, onWithdraw, onDelete, onResumePause,
  loadingId,
}: {
  s: Subscriber;
  canEdit: boolean; canWithdraw: boolean; canDelete: boolean;
  onProfile: () => void; onEdit: () => void; onRenew: () => void; onPayment: () => void;
  onFreeze: () => void; onResume: () => void; onPause: () => void; onWithdraw: () => void;
  onDelete: () => void; onResumePause: () => void;
  loadingId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const isFrozen   = s.freezeData?.isFrozen ?? false;
  const isPaused   = s.subscriptionStatus === "paused";
  const isWithdrawn = s.subscriptionState === "withdrawn";
  const isActive   = !isFrozen && !isPaused && !isWithdrawn;
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback((fn?: () => void) => {
    setOpen(false);
    fn?.();
  }, []);

  const items: { icon: React.ReactNode; label: string; color?: string; action: () => void; show: boolean }[] = [
    { icon: <Eye size={13}/>,         label: "عرض الملف الكامل",   action: () => close(onProfile),     show: true },
    { icon: <Pencil size={13}/>,      label: "تعديل البيانات",      action: () => close(onEdit),        show: canEdit && isActive },
    { icon: <RotateCcw size={13}/>,   label: "تجديد الاشتراك",     action: () => close(onRenew),       show: canEdit },
    { icon: <CreditCard size={13}/>,  label: "إضافة دفعة",         action: () => close(onPayment),     show: canEdit },
    { icon: <MessageCircle size={13}/>, label: "واتساب",            action: () => { close(); window.open(getWhatsAppLink(s.dialCode, s.phone)); }, show: true },
    { icon: <Snowflake size={13}/>,   label: "تجميد الحساب",        action: () => close(onFreeze),      show: canEdit && isActive, color: "#3B82F6" },
    { icon: <Play size={13}/>,        label: "استئناف التجميد",     action: () => close(onResume),      show: canEdit && isFrozen, color: "#3B82F6" },
    { icon: <PauseCircle size={13}/>, label: "إيقاف مؤقت",         action: () => close(onPause),       show: canEdit && isActive },
    { icon: <Play size={13}/>,        label: "استئناف الإيقاف",    action: () => close(onResumePause), show: canEdit && isPaused, color: "#F59E0B" },
    { icon: <UserMinus size={13}/>,   label: "انسحاب",              action: () => close(onWithdraw),    show: canWithdraw && isActive, color: "#EF4444" },
    { icon: <Trash2 size={13}/>,      label: "حذف",                 action: () => close(onDelete),      show: canDelete, color: "#EF4444" },
  ].filter(item => item.show);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          width: 30, height: 30, borderRadius: 8, border: "1px solid var(--jk-divider)",
          background: open ? "var(--jk-hover)" : "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--jk-subtle)", transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--jk-hover)"; e.currentTarget.style.color = "var(--jk-text)"; }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--jk-subtle)"; } }}
      >
        <MoreHorizontal size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              style={{
                position: "absolute", insetInlineEnd: 0, top: "calc(100% + 6px)",
                background: "#FFFFFF", borderRadius: 16, zIndex: 100,
                boxShadow: "0 8px 30px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)",
                border: "1px solid var(--jk-divider)",
                minWidth: 200, overflow: "hidden",
                padding: "6px",
              }}
            >
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); item.action(); }}
                  disabled={loadingId !== null && (item.label === "حذف" || item.label === "استئناف الإيقاف")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 12px", borderRadius: 10, border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "right",
                    fontSize: 13, fontWeight: 600,
                    color: item.color ?? "var(--jk-text)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = item.color ? `${item.color}0f` : "var(--jk-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ color: item.color ?? "var(--jk-subtle)" }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Column header with sort ─────────────────────────────────────────────────────
function SortHeader({ label, field, sortField, sortDir, onSort }: {
  label: string; field: SortField; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      style={{
        display: "flex", alignItems: "center", gap: 4, background: "none",
        border: "none", cursor: "pointer", color: active ? "var(--jk-primary)" : "var(--jk-subtle)",
        fontSize: 11.5, fontWeight: 700, padding: 0, transition: "color 0.15s",
        letterSpacing: "0.03em",
      }}
    >
      {label}
      {active
        ? (sortDir === "asc" ? <ArrowUp size={10}/> : <ArrowDown size={10}/>)
        : <ArrowUpDown size={10} style={{ opacity: 0.35 }}/>
      }
    </button>
  );
}

const TABS: StatusKey[] = ["الكل","نشط","ينتهي قريباً","منتهي","موقوف","متجمد","منسحب"];
const PAGE_SIZES = [15, 30, 50, 100];

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SubscribersPage() {
  const { user, can, exchangeRates } = useAuthStore();
  const { subscribers, loading }     = useSubscribers();
  const { data: activeEmployees = [] } = useActiveEmployees();
  const canRev = can("canViewRevenue");

  const empNameToUid = useMemo(() => {
    const m: Record<string, string> = {};
    activeEmployees.forEach((e) => {
      const name = e.employeeName || e.name || "";
      if (name) m[name] = e.uid;
    });
    return m;
  }, [activeEmployees]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState<StatusKey>("الكل");
  const [search, setSearch]         = useState("");
  const [filterEmp, setFilterEmp]   = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(15);
  const [sortField, setSortField]   = useState<SortField>(null);
  const [sortDir, setSortDir]       = useState<SortDir>("asc");

  // Modal state
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [modal, setModal]       = useState<ModalType>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Confirm dialog state (replaces native confirm())
  const [deleteConfirm,      setDeleteConfirm]      = useState<Subscriber | null>(null);
  const [resumePauseConfirm, setResumePauseConfirm] = useState<Subscriber | null>(null);

  // Drawer state
  const [drawer, setDrawer]     = useState<Subscriber | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openModal  = useCallback((m: ModalType, s: Subscriber) => { setSelected(s); setModal(m); }, []);
  const closeModal = useCallback(() => { setModal(null); setSelected(null); }, []);

  const openDrawer = useCallback((s: Subscriber) => { setDrawer(s); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const employees = useMemo(() => {
    const n = new Set<string>();
    subscribers.forEach((s) => { if (s.convincedBy?.trim()) n.add(s.convincedBy.trim()); });
    return [...n].sort((a, b) => a.localeCompare(b, "ar"));
  }, [subscribers]);

  const counts = useMemo(() => {
    const c = { "الكل": 0, "نشط": 0, "ينتهي قريباً": 0, "منتهي": 0, "موقوف": 0, "متجمد": 0, "منسحب": 0 } as Record<StatusKey, number>;
    for (const s of subscribers) {
      c["الكل"]++;
      c[getDisplayStatus(s)] = (c[getDisplayStatus(s)] ?? 0) + 1;
    }
    return c;
  }, [subscribers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = subscribers.filter((s) => {
      const st = getDisplayStatus(s);
      return (
        (activeTab === "الكل" || st === activeTab) &&
        (!q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q)) &&
        (!filterEmp || s.convincedBy === filterEmp)
      );
    });

    if (sortField) {
      rows = [...rows].sort((a, b) => {
        let av: string | number = 0, bv: string | number = 0;
        if (sortField === "name")           { av = a.name || ""; bv = b.name || ""; }
        if (sortField === "daysRemaining")  { av = a.daysRemaining ?? 0; bv = b.daysRemaining ?? 0; }
        if (sortField === "netAmountUSD")   { av = a.netAmountUSD ?? 0; bv = b.netAmountUSD ?? 0; }
        if (sortField === "expiryDate")     { av = a.expiryDate || ""; bv = b.expiryDate || ""; }
        if (sortField === "date")           { av = a.date || ""; bv = b.date || ""; }
        const cmp = typeof av === "string" ? av.localeCompare(bv as string, "ar") : (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [subscribers, activeTab, search, filterEmp, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged      = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = useCallback((f: SortField) => {
    setSortField(prev => {
      if (prev === f) { setSortDir(d => d === "asc" ? "desc" : "asc"); return f; }
      setSortDir("asc"); return f;
    });
    setPage(1);
  }, []);

  const handleTabChange = useCallback((t: StatusKey) => { setActiveTab(t); setPage(1); }, []);
  const handleSearch    = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  const hasFilters = search || filterEmp;

  const totalRevenue = useMemo(() =>
    filtered.reduce((a, s) => a + (s.netAmountUSD ?? 0), 0), [filtered]);

  const exportCSV = useCallback(() => {
    const hdr = ["الاسم","الهاتف","الباقة","الحالة","الانتهاء","الأيام","المبلغ","الموظف"];
    const data = filtered.map((s) => [
      s.name, s.dialCode + s.phone, s.package, getDisplayStatus(s),
      s.expiryDate, s.daysRemaining, canRev ? `$${formatNumber(s.netAmountUSD)}` : "", s.convincedBy,
    ]);
    const csv = [hdr, ...data].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `مشتركون_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [filtered, canRev]);

  const handleDelete = useCallback((s: Subscriber) => {
    setDeleteConfirm(s);
  }, []);

  const doDelete = useCallback(async () => {
    const s = deleteConfirm;
    if (!s) return;
    setDeleteConfirm(null);
    setLoadingId(`delete-${s.id}`);
    try {
      await callSubscriberOperation("deleteSubscriber", { subscriberId: s.id, subscriberName: s.name });
      toast.success("تم الحذف");
      if (drawer?.id === s.id) closeDrawer();
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoadingId(null); }
  }, [deleteConfirm, drawer, closeDrawer]);

  const handleResumePause = useCallback((s: Subscriber) => {
    setResumePauseConfirm(s);
  }, []);

  const doResumePause = useCallback(async () => {
    const s = resumePauseConfirm;
    if (!s) return;
    setResumePauseConfirm(null);
    setLoadingId(`resume-${s.id}`);
    try {
      await callSubscriberOperation("resumePausedSubscription", { subscriberId: s.id });
      toast.success("تم الاستئناف");
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoadingId(null); }
  }, [resumePauseConfirm]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedLayout>
      {/* Global keyframe styles */}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(0.8)} }
        @keyframes row-glow { 0%,100%{box-shadow:0 2px 8px rgba(91,95,239,0)} 50%{box-shadow:0 4px 20px rgba(91,95,239,0.08)} }
      `}</style>

      <div style={{ padding: "24px", minHeight: "100vh", background: "var(--jk-bg)" }}>

        {/* ══ Page header ══════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.02em" }}>
              إدارة المشتركين
            </h1>
            <p style={{ fontSize: 13, color: "var(--jk-subtle)", margin: "4px 0 0" }}>
              {counts["الكل"]} مشترك إجمالاً
            </p>
          </div>
          {can("canCreate") && (
            <motion.button
              whileHover={{ y: -1, boxShadow: "0 6px 20px rgba(91,95,239,0.35)" }}
              whileTap={{ y: 0 }}
              /*
               * Opens the CREATE modal. This used to be openModal("edit", {} as Subscriber),
               * which broke creating a subscriber from this page entirely: SubscriberModal
               * keys everything off `isEdit = mode === "edit" && !!subscriber`, and an empty
               * object is truthy. So the form opened titled "تعديل بيانات المشترك", hid the
               * first-payment field, the receipt upload and the save-then-collect button,
               * and on submit called updateSubscriber with subscriberId: undefined instead
               * of createSubscriber. The dashboard has always had a correct create path;
               * only this page — the one people actually work from — did not.
               */
              onClick={() => { setSelected(null); setModal("create"); }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "0 18px", height: 40, borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, #5B5FEF, #4F46E5)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(91,95,239,0.30)",
              }}
            >
              <Plus size={15}/>
              مشترك جديد
            </motion.button>
          )}
        </div>

        {/* ══ Main panel ═══════════════════════════════════════════════════════ */}
        <div style={{
          background: "#FFFFFF", borderRadius: 22,
          border: "1px solid var(--jk-divider)",
          boxShadow: "0 4px 24px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04)",
          overflow: "hidden",
        }}>

          {/* ── Smart Toolbar ──────────────────────────────────────────────── */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--jk-divider)",
            background: "linear-gradient(to bottom, #FAFBFF, #FFFFFF)",
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
              <Search size={14} style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                insetInlineEnd: 12, color: "var(--jk-subtle)", pointerEvents: "none",
              }} />
              <input
                type="text"
                placeholder="بحث بالاسم أو الهاتف..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: "100%", height: 38, paddingInlineEnd: 38, paddingInlineStart: 14,
                  borderRadius: 12, border: "1.5px solid var(--jk-border)",
                  fontSize: 13, outline: "none", background: "#fff",
                  color: "var(--jk-text)", transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#5B5FEF";
                  e.target.style.boxShadow = "0 0 0 3px rgba(91,95,239,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--jk-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {search && (
                <button
                  onClick={() => handleSearch("")}
                  style={{
                    position: "absolute", top: "50%", transform: "translateY(-50%)",
                    insetInlineStart: 10, background: "none", border: "none",
                    cursor: "pointer", color: "var(--jk-subtle)", display: "flex",
                    padding: 2,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilter(!showFilter)}
              style={{
                height: 38, padding: "0 14px", borderRadius: 12,
                border: `1.5px solid ${showFilter ? "#5B5FEF" : "var(--jk-border)"}`,
                background: showFilter ? "rgba(91,95,239,0.07)" : "#fff",
                color: showFilter ? "#5B5FEF" : "var(--jk-text)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
              }}
            >
              <SlidersHorizontal size={13}/>
              فلتر
              {filterEmp && (
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#5B5FEF", color: "#fff",
                  fontSize: 10, fontWeight: 800, display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                }}>1</span>
              )}
            </button>

            {/* Export */}
            <button
              onClick={exportCSV}
              style={{
                height: 38, padding: "0 14px", borderRadius: 12,
                border: "1.5px solid var(--jk-border)", background: "#fff",
                color: "var(--jk-text)", fontSize: 13, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#5B5FEF"; e.currentTarget.style.color = "#5B5FEF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--jk-border)"; e.currentTarget.style.color = "var(--jk-text)"; }}
            >
              <Download size={13}/> تصدير
            </button>

            {/* Active filter chips */}
            <AnimatePresence>
              {hasFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  onClick={() => { handleSearch(""); setFilterEmp(""); }}
                  style={{
                    height: 38, padding: "0 12px", borderRadius: 12,
                    border: "1.5px solid #EF4444", background: "rgba(239,68,68,0.06)",
                    color: "#EF4444", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <X size={12}/> مسح الفلاتر
                </motion.button>
              )}
            </AnimatePresence>

            {/* Count */}
            {!loading && (
              <span style={{ fontSize: 12, color: "var(--jk-subtle)", fontWeight: 600, marginInlineStart: "auto" }}>
                {filtered.length} {filtered.length !== counts["الكل"] ? `/ ${counts["الكل"]}` : ""}
              </span>
            )}
          </div>

          {/* ── Filter panel ───────────────────────────────────────────────── */}
          <AnimatePresence>
            {showFilter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{
                  padding: "12px 18px", borderBottom: "1px solid var(--jk-divider)",
                  background: "var(--jk-panel)", display: "flex", gap: 10, flexWrap: "wrap",
                }}>
                  <select
                    value={filterEmp}
                    onChange={(e) => { setFilterEmp(e.target.value); setPage(1); }}
                    style={{
                      height: 36, padding: "0 12px", borderRadius: 10,
                      border: "1.5px solid var(--jk-border)", background: "#fff",
                      fontSize: 13, color: "var(--jk-text)", cursor: "pointer",
                      fontFamily: "inherit", outline: "none",
                    }}
                  >
                    <option value="">كل الموظفين</option>
                    {employees.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  {filterEmp && (
                    <button
                      onClick={() => { setFilterEmp(""); setPage(1); }}
                      style={{
                        height: 36, padding: "0 12px", borderRadius: 10,
                        border: "1.5px solid var(--jk-border)", background: "#fff",
                        fontSize: 12, color: "var(--jk-subtle)", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <X size={11}/> مسح
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Status tabs ────────────────────────────────────────────────── */}
          <div style={{
            display: "flex", gap: 6, padding: "12px 18px",
            borderBottom: "1px solid var(--jk-divider)",
            overflowX: "auto", scrollbarWidth: "none", flexWrap: "nowrap",
          }}>
            {TABS.map((tab) => {
              const active = tab === activeTab;
              const meta   = tab === "الكل" ? null : STATUS_META[tab as Exclude<StatusKey,"الكل">];
              const count  = counts[tab] ?? 0;

              return (
                <motion.button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "6px 14px", borderRadius: 12, flexShrink: 0,
                    border: `1.5px solid ${active ? (meta?.color ?? "#5B5FEF") : "var(--jk-divider)"}`,
                    background: active ? (meta ? meta.bg : "rgba(91,95,239,0.08)") : "transparent",
                    color: active ? (meta?.color ?? "#5B5FEF") : "var(--jk-subtle)",
                    fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: active ? `0 2px 10px ${meta?.glow ?? "rgba(91,95,239,0.15)"}` : "none",
                  }}
                >
                  {meta && active && (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: meta.color, flexShrink: 0,
                    }} />
                  )}
                  {tab}
                  <span style={{
                    minWidth: 20, height: 18, padding: "0 5px", borderRadius: 8,
                    fontSize: 10.5, fontWeight: 800,
                    background: active ? (meta?.color ?? "#5B5FEF") : "rgba(156,163,175,0.15)",
                    color: active ? "#fff" : "var(--jk-subtle)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {count}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* ── Table ──────────────────────────────────────────────────────── */}
          {loading ? (
            <div>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ padding: "60px 24px", textAlign: "center" }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--jk-panel)", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <Users size={22} style={{ color: "var(--jk-subtle)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--jk-text)", marginBottom: 6 }}>
                لا يوجد مشتركون
              </div>
              <div style={{ fontSize: 13, color: "var(--jk-subtle)" }}>
                {hasFilters ? "حاول تغيير الفلاتر أو مسحها" : "لا يوجد مشتركون في هذه الحالة"}
              </div>
            </motion.div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              {/* Table Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1fr 1.1fr 1fr 1fr 1fr 185px",
                gap: 0,
                padding: "10px 20px",
                background: "#F8FAFC",
                borderBottom: "1px solid var(--jk-divider)",
                position: "sticky", top: 0, zIndex: 10,
                minWidth: 780,
              }}>
                {[
                  { label: "المشترك",        field: "name" as SortField,        hide: false },
                  { label: "الخطة",           field: null,                       hide: false },
                  { label: "الحالة",          field: null,                       hide: false },
                  { label: "المبلغ",          field: canRev ? "netAmountUSD" as SortField : null, hide: !canRev },
                  { label: "الانتهاء",        field: "expiryDate" as SortField,  hide: false },
                  { label: "الأيام",          field: "daysRemaining" as SortField, hide: false },
                  { label: "الإجراءات",       field: null,                       hide: false },
                ].map((h, i) => (
                  <div key={i} style={{ textAlign: i === 6 ? "center" : "right", visibility: h.hide ? "hidden" : undefined }}>
                    {h.field
                      ? <SortHeader label={h.label} field={h.field} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      : <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--jk-subtle)", letterSpacing: "0.03em" }}>{h.label}</span>
                    }
                  </div>
                ))}
              </div>

              {/* Rows */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                style={{ minWidth: 780 }}
              >
                {paged.map((s) => {
                  const st         = getDisplayStatus(s);
                  const isFrozen   = s.freezeData?.isFrozen ?? false;
                  const isPaused   = s.subscriptionStatus === "paused";
                  const isWithdrawn = s.subscriptionState === "withdrawn";
                  const isActive   = !isFrozen && !isPaused && !isWithdrawn;
                  const isExpiring = isActive && s.daysRemaining >= 0 && s.daysRemaining <= 7;

                  return (
                    <motion.div
                      key={s.id}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
                      }}
                      onClick={() => openDrawer(s)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2.2fr 1fr 1.1fr 1fr 1fr 1fr 185px",
                        alignItems: "center",
                        gap: 0, padding: "12px 20px",
                        borderBottom: "1px solid var(--jk-divider)",
                        cursor: "pointer",
                        background: isExpiring ? "rgba(245,158,11,0.025)" : "transparent",
                        transition: "all 0.18s ease",
                        position: "relative",
                      }}
                      whileHover={{
                        y: -1,
                        backgroundColor: "rgba(91,95,239,0.025)",
                        boxShadow: "0 4px 18px rgba(91,95,239,0.08), 0 1px 4px rgba(15,23,42,0.04)",
                      }}
                    >
                      {/* Subscriber identity */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <PremiumAvatar name={s.name} status={st} />
                        <div>
                          <div style={{ marginBottom: 2 }}>
                            <SubscriberNameChip
                              subscriber={s}
                              style={{ fontSize: 13, fontWeight: 700, color: "var(--jk-text)" }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--jk-subtle)", direction: "ltr", textAlign: "right" }}>
                            {s.dialCode} {s.phone}
                          </div>
                          {s.convincedBy && (
                            <div style={{ marginTop: 2 }}>
                              <EmployeeNameChip
                                name={s.convincedBy}
                                uid={empNameToUid[s.convincedBy] || undefined}
                                style={{ fontSize: 10, color: "var(--jk-subtle)", fontWeight: 600 }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Package */}
                      <div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                          background: s.package === "ذهبية" ? "rgba(245,158,11,0.1)" : "rgba(107,114,128,0.08)",
                          color: s.package === "ذهبية" ? "#D97706" : "#6B7280",
                          border: s.package === "ذهبية" ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(107,114,128,0.12)",
                        }}>
                          {s.package === "ذهبية" ? "⭐" : "◈"} {s.package}
                          {s.renewalCount > 0 && (
                            <span style={{ fontSize: 9, opacity: 0.7 }}>×{s.renewalCount}</span>
                          )}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <PremiumStatusBadge status={st} />
                      </div>

                      {/* Amount */}
                      {canRev ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--jk-text)" }}>
                            ${formatNumber(s.netAmountUSD)}
                          </div>
                          {(s.remainingAmountUSD ?? 0) > 0.01 && (
                            <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 600 }}>
                              متبقي ${formatNumber(s.remainingAmountUSD)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: "var(--jk-subtle)" }}>—</div>
                      )}

                      {/* Expiry */}
                      <div style={{ fontSize: 12, color: "var(--jk-muted)" }}>
                        {isFrozen && s.freezeData?.originalExpiryDate
                          ? s.freezeData.originalExpiryDate
                          : formatDate(s.expiryDate) || "—"}
                      </div>

                      {/* Days */}
                      <div style={{ fontSize: 12 }}>
                        <DaysCell s={s} isFrozen={isFrozen} isPaused={isPaused} isWithdrawn={isWithdrawn} />
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }} onClick={(e) => e.stopPropagation()}>
                        {/*
                          * Renew and record-payment sit in the row itself.
                          *
                          * Both were reachable only through the "…" menu, which
                          * made the two most repeated jobs in the business cost
                          * two clicks on every line. Everything rarer stays in
                          * the menu — the point is a short list of obvious
                          * actions, not a row of icons nobody can tell apart.
                          */}
                        {can("canEdit") && (
                          <QuickAction
                            label="تجديد"
                            icon={<RotateCcw size={13} />}
                            color="#F59E0B"
                            onClick={() => openModal("renew", s)}
                          />
                        )}
                        {can("canEdit") && (
                          <QuickAction
                            label="دفعة"
                            icon={<CreditCard size={13} />}
                            color="#5B5FEF"
                            onClick={() => openModal("payment", s)}
                          />
                        )}
                        <ActionMenu
                          s={s}
                          canEdit={can("canEdit")}
                          canWithdraw={can("canWithdraw")}
                          canDelete={can("canDelete")}
                          onProfile={() => openModal("profile", s)}
                          onEdit={() => openModal("edit", s)}
                          onRenew={() => openModal("renew", s)}
                          onPayment={() => openModal("payment", s)}
                          onFreeze={() => openModal("freeze", s)}
                          onResume={() => openModal("resume", s)}
                          onPause={() => openModal("pause", s)}
                          onWithdraw={() => openModal("withdraw", s)}
                          onDelete={() => handleDelete(s)}
                          onResumePause={() => handleResumePause(s)}
                          loadingId={loadingId}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}

          {/* ── Footer / Pagination ─────────────────────────────────────────── */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", borderTop: "1px solid var(--jk-divider)",
              background: "#FAFBFF", flexWrap: "wrap", gap: 10,
            }}>
              {/* Left: revenue */}
              <div style={{ fontSize: 12, color: "var(--jk-subtle)", display: "flex", gap: 16, alignItems: "center" }}>
                <span>
                  عرض <strong style={{ color: "var(--jk-text)" }}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</strong> من <strong style={{ color: "var(--jk-text)" }}>{filtered.length}</strong>
                </span>
                {canRev && (
                  <span>
                    الإجمالي: <strong style={{ color: "#22C55E" }}>${formatNumber(totalRevenue)}</strong>
                  </span>
                )}
              </div>

              {/* Center: page size */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {PAGE_SIZES.map((n) => (
                  <button
                    key={n}
                    onClick={() => { setPageSize(n); setPage(1); }}
                    style={{
                      width: 32, height: 28, borderRadius: 8, border: "1.5px solid",
                      borderColor: pageSize === n ? "#5B5FEF" : "var(--jk-divider)",
                      background: pageSize === n ? "#5B5FEF" : "transparent",
                      color: pageSize === n ? "#fff" : "var(--jk-subtle)",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                    }}
                  >{n}</button>
                ))}
              </div>

              {/* Right: page navigation */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: 32, height: 32, borderRadius: 9, border: "1.5px solid var(--jk-divider)",
                    background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: page === 1 ? "var(--jk-subtle)" : "var(--jk-text)", opacity: page === 1 ? 0.4 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  <ChevronRight size={14}/>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        width: 32, height: 32, borderRadius: 9, border: "1.5px solid",
                        borderColor: page === p ? "#5B5FEF" : "var(--jk-divider)",
                        background: page === p ? "#5B5FEF" : "#fff",
                        color: page === p ? "#fff" : "var(--jk-text)",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >{p}</button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    width: 32, height: 32, borderRadius: 9, border: "1.5px solid var(--jk-divider)",
                    background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: page === totalPages ? "var(--jk-subtle)" : "var(--jk-text)",
                    opacity: page === totalPages ? 0.4 : 1, transition: "all 0.15s",
                  }}
                >
                  <ChevronLeft size={14}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Subscriber Drawer ════════════════════════════════════════════════ */}
      <SubscriberDrawer
        subscriber={drawer}
        open={drawerOpen}
        onClose={closeDrawer}
        canEdit={can("canEdit")}
        canWithdraw={can("canWithdraw")}
        canDelete={can("canDelete")}
        canViewRevenue={canRev}
        onOpenModal={(m, sub) => { openModal(m, sub); closeDrawer(); }}
        onDelete={(sub) => { handleDelete(sub); }}
        onResumePause={handleResumePause}
        loadingId={loadingId}
      />

      {/* ══ Modals ════════════════════════════════════════════════════════════ */}
      {selected && modal === "profile" && (
        <ProfileModal subscriber={selected} onClose={closeModal}
          onEdit={() => openModal("edit", selected)}
          onRenew={() => openModal("renew", selected)}
          onAddPayment={() => openModal("payment", selected)} />
      )}
      {modal === "create" && (
        <SubscriberModal mode="add" exchangeRates={exchangeRates}
          onClose={closeModal} onSaved={closeModal} />
      )}
      {selected && modal === "edit" && (
        <SubscriberModal mode="edit" subscriber={selected} exchangeRates={exchangeRates}
          onClose={closeModal} onSaved={closeModal} />
      )}
      {selected && modal === "renew" && (
        <RenewalModal subscriber={selected} exchangeRates={exchangeRates}
          onClose={closeModal} onSaved={closeModal} />
      )}
      {selected && modal === "payment" && (
        <PaymentModal subscriber={selected} exchangeRates={exchangeRates}
          onClose={closeModal} onSaved={closeModal} />
      )}
      {selected && modal === "withdraw" && (
        <WithdrawModal subscriber={selected} exchangeRates={exchangeRates}
          onClose={closeModal} onSaved={closeModal} />
      )}
      {selected && modal === "pause" && (
        <PauseModal subscriber={selected} onClose={closeModal} onSaved={closeModal} />
      )}
      {selected && modal === "freeze" && (
        <FreezeModal subscriber={selected} isOpen onClose={closeModal} onFrozen={closeModal}
          currentUser={{ uid: user?.uid ?? "", displayName: user?.name ?? "" }} />
      )}
      {selected && modal === "resume" && (
        <ResumeModal subscriber={selected} isOpen onClose={closeModal} onResumed={closeModal}
          currentUser={{ uid: user?.uid ?? "", displayName: user?.name ?? "" }} />
      )}

      {/* ── Confirm dialogs (replace native confirm()) ──────────────────────── */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={doDelete}
        title={`حذف "${deleteConfirm?.name}"؟`}
        description="سيتم حذف المشترك بشكل مؤقت. يمكن استعادته لاحقاً من قاعدة البيانات."
        confirmLabel="حذف"
        destructive
        loading={loadingId?.startsWith("delete-")}
      />
      <ConfirmDialog
        open={!!resumePauseConfirm}
        onClose={() => setResumePauseConfirm(null)}
        onConfirm={doResumePause}
        title={`استئناف اشتراك "${resumePauseConfirm?.name}"؟`}
        description="سيتم استئناف الاشتراك الموقوف وإعادة احتساب تاريخ الانتهاء."
        confirmLabel="استئناف"
        loading={loadingId?.startsWith("resume-")}
      />
    </ProtectedLayout>
  );
}
