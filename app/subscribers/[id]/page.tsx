"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import Link from "next/link";
import { db } from "@/lib/firestore";
import {
  normalizeSubscriber, formatDate, getWhatsAppLink,
} from "@/lib/utils";
import { usePayments } from "@/hooks/usePayments";
import { useRefunds }  from "@/hooks/useRefunds";
import { useAuthStore }  from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import ProtectedLayout    from "@/components/layout/ProtectedLayout";
import SubscriberModal    from "@/components/subscribers/SubscriberModal";
import RenewalModal       from "@/components/subscribers/RenewalModal";
import PaymentModal       from "@/components/subscribers/PaymentModal";
import WorkflowStatusBadge from "@/components/subscribers/WorkflowStatusBadge";
import OverviewTab    from "@/components/subscribers/workspace/OverviewTab";
import AssignmentsTab from "@/components/subscribers/workspace/AssignmentsTab";
import NotesPanel     from "@/components/subscribers/NotesPanel";
import PaymentsTab    from "@/components/subscribers/workspace/PaymentsTab";
import RenewalsTab    from "@/components/subscribers/workspace/RenewalsTab";
import ActivityTab    from "@/components/subscribers/workspace/ActivityTab";
import TimelineTab    from "@/components/subscribers/workspace/TimelineTab";
import type { Subscriber } from "@/types";
import {
  ArrowRight, Edit, RefreshCw, DollarSign, Phone,
  AlertCircle, CheckCircle2, XCircle, PauseCircle,
  Snowflake, MessageCircle, LayoutDashboard, UserCheck,
  StickyNote, CreditCard, RotateCcw, Activity, GitBranch,
} from "lucide-react";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const LT = {
  bg:      "var(--page-bg)",
  card:    "var(--surface)",
  border:  "rgba(15,23,42,0.08)",
  t1:      "var(--text-primary)",
  t2:      "#64748b",
  shadow:  "0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05)",
};
const DT = {
  bg:      "#070c18",
  card:    "rgba(255,255,255,0.04)",
  border:  "rgba(255,255,255,0.08)",
  t1:      "#f1f5f9",
  t2:      "#64748b",
  shadow:  "none",
};

const ACC = { indigo:"#6366f1", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8" };
const tran = { duration:0.36, ease:"easeOut" } as const;

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0,2).join("").toUpperCase() || "؟";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "نشط")         return <CheckCircle2 size={13} className="text-emerald-500"/>;
  if (status === "ينتهي قريباً") return <AlertCircle  size={13} className="text-amber-500"/>;
  if (status === "منتهي")       return <XCircle       size={13} className="text-rose-500"/>;
  if (status === "موقوف")       return <PauseCircle   size={13} className="text-orange-500"/>;
  if (status === "متجمد")       return <Snowflake     size={13} className="text-sky-500"/>;
  return <XCircle size={13} className="text-slate-400"/>;
}

function statusColor(status: string) {
  if (status === "نشط")          return ACC.emerald;
  if (status === "ينتهي قريباً") return ACC.amber;
  if (status === "منتهي")        return ACC.rose;
  if (status === "موقوف")        return "#f97316";
  if (status === "متجمد")        return ACC.sky;
  return "#64748b";
}

// ── Tab definitions ───────────────────────────────────────────────────────────
type TabKey = "overview" | "assignments" | "notes" | "payments" | "renewals" | "activity" | "timeline";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key:"overview",     label:"نظرة عامة",    icon:<LayoutDashboard size={13}/> },
  { key:"timeline",     label:"التسلسل الزمني", icon:<GitBranch  size={13}/> },
  { key:"assignments",  label:"التعيين",       icon:<UserCheck  size={13}/> },
  { key:"notes",        label:"الملاحظات",    icon:<StickyNote size={13}/> },
  { key:"payments",     label:"الدفعات",      icon:<CreditCard size={13}/> },
  { key:"renewals",     label:"التجديدات",    icon:<RotateCcw  size={13}/> },
  { key:"activity",     label:"السجل",         icon:<Activity   size={13}/> },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubscriberWorkspacePage() {
  const params            = useParams();
  const router            = useRouter();
  const id                = typeof params.id === "string" ? params.id : "";
  const { dark }          = useThemeStore();
  const t                 = dark ? DT : LT;
  const { can, user, exchangeRates } = useAuthStore();
  const canRev            = can("canViewRevenue");

  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [notFound, setNotFound]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<"edit"|"renew"|"pay"|null>(null);
  const [tab, setTab]               = useState<TabKey>("overview");

  // Payments + refunds needed by overview + payments + activity tabs
  const { payments } = usePayments({ subscriberId: id });
  const { refunds }  = useRefunds ({ subscriberId: id });

  // Real-time subscriber listener
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, "subscribers", id),
      (snap) => {
        if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
        setSubscriber(normalizeSubscriber({ id: snap.id, ...snap.data() } as Record<string,unknown>&{id:string}));
        setLoading(false);
      },
      () => { setNotFound(true); setLoading(false); }
    );
    return () => unsub();
  }, [id]);

  const onSaved = useCallback(() => setModal(null), []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex items-center justify-center" style={{ background:t.bg }}>
          <div className="flex flex-col items-center gap-4">
            {/* Skeleton header */}
            <div className="animate-pulse space-y-3 w-72">
              <div className="h-20 w-20 rounded-2xl mx-auto" style={{ background:"var(--surface-2)" }}/>
              <div className="h-4 rounded-full w-40 mx-auto" style={{ background:"var(--surface-2)" }}/>
              <div className="h-3 rounded-full w-28 mx-auto" style={{ background:"var(--surface-2)" }}/>
            </div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (notFound || !subscriber) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-4" style={{ background:t.bg }}>
          <AlertCircle size={40} style={{ color:ACC.rose }}/>
          <p style={{ color:t.t1 }} className="font-bold text-lg">المشترك غير موجود</p>
          <Link href="/" className="text-sm px-4 py-2 rounded-xl text-white"
            style={{ background:ACC.indigo }}>
            العودة للرئيسية
          </Link>
        </div>
      </ProtectedLayout>
    );
  }

  const s  = subscriber;
  const sc = statusColor(s.status);

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background:t.bg }}>
        <div className="mx-auto max-w-5xl px-4 pt-5 md:px-7">

          {/* ── Back ── */}
          <motion.div
            initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} transition={tran}
            className="mb-5">
            <button onClick={() => router.back()}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color:t.t2 }}>
              <ArrowRight size={15}/>
              العودة
            </button>
          </motion.div>

          {/* ── Profile Header ── */}
          <motion.div
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={tran}
            className="rounded-2xl overflow-hidden mb-5"
            style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>

            {/* Accent bar */}
            <div className="h-1.5" style={{ background:`linear-gradient(90deg,${ACC.indigo},${ACC.sky})` }}/>

            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="h-20 w-20 rounded-2xl flex items-center justify-center
                    text-2xl font-black text-white"
                    style={{ background:`linear-gradient(135deg,${ACC.indigo},${ACC.sky})` }}>
                    {initials(s.name)}
                  </div>
                  <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-2
                    flex items-center justify-center"
                    style={{ background:t.card, borderColor:t.border }}>
                    <StatusIcon status={s.status}/>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-xl font-black" style={{ color:t.t1 }}>{s.name}</h1>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ background:`${sc}15`, color:sc, border:`1px solid ${sc}30` }}>
                      <StatusIcon status={s.status}/>{s.status}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.package==="ذهبية"?"pkg-gold":"pkg-silver"}`}>
                      {s.package}
                    </span>
                    {s.workflowStatus && (
                      <WorkflowStatusBadge status={s.workflowStatus} size="sm"/>
                    )}
                    {s.assignedTeamName && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background:`${ACC.indigo}12`, color:ACC.indigo, border:`1px solid ${ACC.indigo}25` }}>
                        {s.assignedTeamName}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color:t.t2 }}>
                    {(s.dialCode || s.phone) && (
                      <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors">
                        <Phone size={11}/>{s.dialCode} {s.phone}
                      </a>
                    )}
                    <span className="flex items-center gap-1.5">
                      انضم {formatDate(s.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      ينتهي {formatDate(s.expiryDate)}
                      <span style={{ color: s.daysRemaining <= 7 ? ACC.rose : s.daysRemaining <= 15 ? ACC.amber : ACC.emerald }}>
                        {s.daysRemaining > 0 ? `(${s.daysRemaining} يوم)` : "(منتهي)"}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  {can("canEdit") && (
                    <button onClick={() => setModal("edit")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background:`${ACC.indigo}15`, color:ACC.indigo, border:`1px solid ${ACC.indigo}25` }}>
                      <Edit size={13}/>تعديل
                    </button>
                  )}
                  {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                    <button onClick={() => setModal("renew")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background:`${ACC.emerald}15`, color:ACC.emerald, border:`1px solid ${ACC.emerald}25` }}>
                      <RefreshCw size={13}/>تجديد
                    </button>
                  )}
                  {can("canCreate") && (
                    <button onClick={() => setModal("pay")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background:`${ACC.amber}15`, color:ACC.amber, border:`1px solid ${ACC.amber}25` }}>
                      <DollarSign size={13}/>دفعة
                    </button>
                  )}
                  {s.dialCode && s.phone && (
                    <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background:"rgba(37,211,102,0.12)", color:"#25d366", border:"1px solid rgba(37,211,102,0.25)" }}>
                      <MessageCircle size={13}/>واتساب
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="border-t overflow-x-auto" style={{ borderColor:t.border }}>
              <div className="flex min-w-max px-4">
                {TABS.map(({ key, label, icon }) => {
                  const active = tab === key;
                  return (
                    <button key={key} onClick={() => setTab(key)}
                      className="relative flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold
                        whitespace-nowrap transition-colors"
                      style={{ color: active ? ACC.indigo : t.t2 }}>
                      <span style={{ color: active ? ACC.indigo : t.t2 }}>{icon}</span>
                      {label}
                      {active && (
                        <motion.div layoutId="tab-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                          style={{ background:ACC.indigo }}
                          transition={{ duration:0.2 }}/>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* ── Tab Content ── */}
          <div className="pb-10">
            {tab === "overview" && (
              <OverviewTab subscriber={s} payments={payments} refunds={refunds} canRev={canRev}/>
            )}
            {tab === "timeline" && (
              <TimelineTab subscriber={s} payments={payments} refunds={refunds} canRev={canRev}/>
            )}
            {tab === "assignments" && (
              <AssignmentsTab subscriber={s}/>
            )}
            {tab === "notes" && (
              <NotesPanel subscriberId={s.id} subscriberName={s.name}/>
            )}
            {tab === "payments" && (
              <PaymentsTab
                subscriber={s}
                onAddPayment={() => setModal("pay")}
              />
            )}
            {tab === "renewals" && (
              <RenewalsTab
                subscriber={s}
                onRenew={() => setModal("renew")}
                canRev={canRev}
              />
            )}
            {tab === "activity" && (
              <ActivityTab subscriber={s} canRev={canRev}/>
            )}
          </div>
        </div>

        {/* ── Modals ── */}
        {modal === "edit" && (
          <SubscriberModal mode="edit" subscriber={s} exchangeRates={exchangeRates}
            onClose={() => setModal(null)} onSaved={onSaved}/>
        )}
        {modal === "renew" && (
          <RenewalModal subscriber={s} exchangeRates={exchangeRates}
            onClose={() => setModal(null)} onSaved={onSaved}/>
        )}
        {modal === "pay" && (
          <PaymentModal subscriber={s} exchangeRates={exchangeRates}
            onClose={() => setModal(null)} onSaved={onSaved}/>
        )}
      </div>
    </ProtectedLayout>
  );
}
