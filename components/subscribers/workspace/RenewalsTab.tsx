"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore }       from "@/store/authStore";
import { auth }               from "@/lib/auth";
import { canManageRenewals, canRenewSubscriptions } from "@/lib/permissionGuards";
import {
  RENEWAL_STATUS, RENEWAL_STATUS_LABELS, RENEWAL_STATUS_COLORS,
  type RenewalWorkflowStatus,
} from "@/constants/subscriberWorkflow";
import { formatDate, formatNumber } from "@/lib/utils";

function fmtDate(raw: unknown): string {
  if (!raw) return "—";
  if (typeof raw === "string") return formatDate(raw);
  if (raw instanceof Date) return formatDate(raw.toISOString().slice(0,10));
  if (typeof (raw as {toDate?():Date}).toDate === "function")
    return formatDate((raw as {toDate():Date}).toDate().toISOString().slice(0,10));
  return String(raw);
}
import type { Subscriber } from "@/types";
import {
  RefreshCw, Clock, Check,  PhoneCall,
  XCircle, CheckCircle2, ChevronDown, ChevronUp, User, Handshake} from "lucide-react";

const ACC = { indigo:"#5B5FEF", emerald:"#5B5FEF", amber:"#F59E0B", rose:"#EF4444", sky:"#3B82F6" };
const fadeUp = { hidden:{opacity:0,y:10}, show:{opacity:1,y:0} };
const tran   = { duration:0.28, ease:"easeOut" } as const;
const stagger = { show:{transition:{staggerChildren:0.05}} };

async function postRenewalStatus(payload: {
  subscriberId:          string;
  subscriberName:        string;
  renewalWorkflowStatus: RenewalWorkflowStatus;
  renewalNote?:          string;
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized");
  const res = await fetch("/api/subscribers/renewal-status", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify(payload),
  });
  const data = await res.json() as { success?: boolean; error?: string };
  if (!res.ok || !data.success) throw new Error(data.error ?? "Failed");
}

function useUpdateRenewalStatus() {
  return useMutation({
    mutationFn: postRenewalStatus,
  });
}

function RenewalStatusBadge({ status }: { status: RenewalWorkflowStatus | undefined }) {
  if (!status) return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background:"var(--surface-2)", color:"var(--text-muted)", border:"1px solid var(--border)" }}>
      غير محدد
    </span>
  );
  const { bg, color } = RENEWAL_STATUS_COLORS[status];
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background:bg, color, border:`1px solid ${color}30` }}>
      {RENEWAL_STATUS_LABELS[status]}
    </span>
  );
}

function DaysIndicator({ days }: { days: number }) {
  const urgent = days <= 7;
  const near   = days <= 15;
  const color  = days <= 0 ? ACC.rose : urgent ? ACC.rose : near ? ACC.amber : ACC.emerald;
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:`${color}10`, border:`1px solid ${color}28` }}>
      <div className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background:`${color}18` }}>
        <Clock size={18} style={{ color }}/>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color:"var(--text-muted)" }}>
          الأيام المتبقية
        </p>
        <p className="text-2xl font-black tabular-nums" style={{ color }}>
          {days > 0 ? days : "منتهي"}
        </p>
        {urgent && days > 0 && (
          <p className="text-[10px] font-bold mt-0.5" style={{ color:ACC.rose }}>⚡ ينتهي قريباً</p>
        )}
      </div>
    </div>
  );
}

// ── Renewal history hook (sub-collection + legacy array fallback) ──────────────

type RenewalRecord = {
  renewalNumber?: number;
  package?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  totalPriceUSD?: number;
  paidAmountUSD?: number;
  remainingAmountUSD?: number;
  currency?: string;
  payment?: string;
  convincedBy?: string;
  renewedByName?: string;
  createdAt?: unknown;
};

function useRenewalHistory(subscriberId: string, legacyArray: RenewalRecord[] | undefined) {
  const [history, setHistory] = useState<RenewalRecord[]>([]);

  useEffect(() => {
    if (!subscriberId) return;
    getDocs(
      query(
        collection(db, "subscribers", subscriberId, "renewalHistory"),
        orderBy("createdAt", "desc")
      )
    ).then((snap) => {
      const docs = snap.docs.map((d) => ({ ...d.data() } as RenewalRecord));
      // Merge: sub-collection records take precedence; legacy array fills gaps
      // Identify legacy entries not yet in sub-collection (by renewalNumber)
      const subCollectionNumbers = new Set(docs.map((d) => d.renewalNumber));
      const legacyOnly = (legacyArray ?? [])
        .filter((_, i) => !subCollectionNumbers.has(i + 1))
        .map((r, i) => ({ ...r, renewalNumber: i + 1 }));
      setHistory([...docs, ...legacyOnly].sort((a, b) => (b.renewalNumber ?? 0) - (a.renewalNumber ?? 0)));
    }).catch(() => {
      // Fallback to legacy array on error
      setHistory([...(legacyArray ?? [])].reverse());
    });
  }, [subscriberId, legacyArray]);

  return history;
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  subscriber: Subscriber;
  onRenew: () => void;
  canRev: boolean;
}

export default function RenewalsTab({ subscriber: s, onRenew, canRev }: Props) {
  const { user }     = useAuthStore();
  const updateStatus = useUpdateRenewalStatus();
  const renewalHistory = useRenewalHistory(s.id, s.renewals as RenewalRecord[] | undefined);

  const canManage  = canManageRenewals(user)        || user?.role === "owner" || user?.role === "admin";
  const canRenewSub= canRenewSubscriptions(user)    || user?.role === "owner" || user?.role === "admin";

  const [note, setNote]             = useState(s.renewalNote ?? "");
  const [showNote, setShowNote]     = useState(false);
  const [err, setErr]               = useState("");
  const [success, setSuccess]       = useState("");
  const [expandRenewals, setExpand] = useState(true);

  const current = s.renewalWorkflowStatus;

  async function handleStatusChange(status: RenewalWorkflowStatus) {
    if (status === current) return;
    try {
      setErr(""); setSuccess("");
      await updateStatus.mutateAsync({
        subscriberId:          s.id,
        subscriberName:        s.name,
        renewalWorkflowStatus: status,
        renewalNote:           note || undefined,
      });
      setSuccess(RENEWAL_STATUS_LABELS[status]);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  const statusActions: { key: RenewalWorkflowStatus; label: string; icon: React.ReactNode; accent: string }[] = [
    { key: RENEWAL_STATUS.PENDING,   label:"قيد الانتظار",  icon:<Clock size={13}/>,        accent:ACC.amber },
    { key: RENEWAL_STATUS.CONTACTED, label:"تم التواصل",    icon:<PhoneCall size={13}/>,    accent:ACC.indigo },
    { key: RENEWAL_STATUS.PROMISED,  label:"وعد بالدفع",    icon:<Handshake size={13}/>,    accent:ACC.sky },
    { key: RENEWAL_STATUS.RENEWED,   label:"تم التجديد",    icon:<CheckCircle2 size={13}/>, accent:ACC.emerald },
    { key: RENEWAL_STATUS.DECLINED,  label:"رفض التجديد",   icon:<XCircle size={13}/>,      accent:ACC.rose },
  ];

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

      {/* ── Days + expiry ── */}
      <motion.div variants={fadeUp} transition={tran} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DaysIndicator days={s.daysRemaining}/>

        <div className="rounded-2xl p-4 col-span-2"
          style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold" style={{ color:"var(--text-primary)" }}>حالة التجديد</span>
            <RenewalStatusBadge status={current}/>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color:"var(--text-muted)" }}>تاريخ الانتهاء</span>
              <p className="font-semibold mt-0.5" style={{ color:"var(--text-primary)" }}>
                {formatDate(s.expiryDate)}
              </p>
            </div>
            <div>
              <span style={{ color:"var(--text-muted)" }}>عدد التجديدات</span>
              <p className="font-semibold mt-0.5" style={{ color:"var(--text-primary)" }}>
                {s.renewalCount || 0} مرة
              </p>
            </div>
            {s.renewalHandledByName && (
              <div>
                <span style={{ color:"var(--text-muted)" }}>مسؤول التجديد</span>
                <p className="font-semibold mt-0.5 flex items-center gap-1" style={{ color:"var(--text-primary)" }}>
                  <User size={10}/>{s.renewalHandledByName}
                </p>
              </div>
            )}
            {s.lastRenewalDate && (
              <div>
                <span style={{ color:"var(--text-muted)" }}>آخر تجديد</span>
                <p className="font-semibold mt-0.5" style={{ color:"var(--text-primary)" }}>
                  {fmtDate(s.lastRenewalDate)}
                </p>
              </div>
            )}
          </div>
          {s.renewalNote && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor:"var(--divider)" }}>
              <p className="text-[10px] font-medium mb-0.5" style={{ color:"var(--text-muted)" }}>ملاحظة التجديد</p>
              <p className="text-xs" style={{ color:"var(--text-secondary)" }}>{s.renewalNote}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Renewal actions ── */}
      {canManage && (
        <motion.div variants={fadeUp}
          className="rounded-2xl overflow-hidden"
          style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>إجراءات التجديد</span>
          </div>
          <div className="p-5 space-y-4">
            {err && (
              <div className="p-3 rounded-xl text-xs" style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#EF4444" }}>
                {err}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold"
                style={{ background:`${ACC.emerald}12`, color:ACC.emerald, border:`1px solid ${ACC.emerald}25` }}>
                <Check size={13}/>تم التحديث: {success}
              </div>
            )}

            {/* Status action buttons */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color:"var(--text-secondary)" }}>تغيير حالة التجديد</p>
              <div className="grid grid-cols-2 gap-2">
                {statusActions.map(({ key, label, icon, accent }) => (
                  <button
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    disabled={updateStatus.isPending || current === key}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold
                      transition-all disabled:opacity-50"
                    style={{
                      background: current === key ? `${accent}20` : "var(--surface-2)",
                      color:      current === key ? accent : "var(--text-secondary)",
                      border:     `1px solid ${current === key ? accent + "40" : "var(--border)"}`,
                    }}>
                    <span style={{ color:accent }}>{icon}</span>
                    {label}
                    {current === key && <Check size={11} className="mr-auto" style={{ color:accent }}/>}
                  </button>
                ))}
              </div>
            </div>

            {/* Note toggle */}
            <div>
              <button
                onClick={() => setShowNote((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color:"var(--text-muted)" }}>
                {showNote ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                إضافة ملاحظة تجديد
              </button>
              <AnimatePresence>
                {showNote && (
                  <motion.div
                    initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                    exit={{ height:0, opacity:0 }} transition={{ duration:0.18 }}
                    className="overflow-hidden mt-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="form-input w-full text-xs resize-none"
                      placeholder="ملاحظة عن التجديد..."
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Renew button */}
            {canRenewSub && s.subscriptionState !== "withdrawn" && (
              <div className="pt-2 border-t" style={{ borderColor:"var(--divider)" }}>
                <button onClick={onRenew}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                    text-white font-bold text-sm transition-all"
                  style={{ background:`linear-gradient(135deg,${ACC.emerald},#5B5FEF)` }}>
                  <RefreshCw size={15}/>تجديد الاشتراك
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Renewal history ── */}
      <motion.div variants={fadeUp} transition={tran}
        className="rounded-2xl overflow-hidden"
        style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
        <button
          onClick={() => setExpand((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <RefreshCw size={14} style={{ color:"var(--text-muted)" }}/>
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
              سجل التجديدات
            </span>
            {renewalHistory.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:`${ACC.indigo}18`, color:ACC.indigo }}>
                {renewalHistory.length}
              </span>
            )}
          </div>
          {expandRenewals ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>

        <AnimatePresence>
          {expandRenewals && (
            <motion.div
              initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
              exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
              className="overflow-hidden">
              <div className="p-5">
                {renewalHistory.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color:"var(--text-muted)" }}>
                    لا يوجد تجديدات سابقة
                  </p>
                ) : (
                  <div className="space-y-3">
                    {renewalHistory.map((r, i) => (
                      <div key={r.renewalNumber ?? i}
                        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                        style={{ background:"var(--surface-2)", border:"1px solid var(--divider)" }}>
                        <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-xs font-black"
                          style={{ background:`${ACC.indigo}15`, color:ACC.indigo }}>
                          {r.renewalNumber ?? (renewalHistory.length - i)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${r.package==="ذهبية"?"pkg-gold":"pkg-silver"}`}>
                              {r.package}
                            </span>
                            <span className="text-xs" style={{ color:"var(--text-secondary)" }}>
                              {r.startDate} → {r.endDate} ({r.duration} يوم)
                            </span>
                          </div>
                          {canRev && (
                            <p className="text-xs font-semibold" style={{ color:ACC.emerald }}>
                              ${formatNumber(r.paidAmountUSD ?? 0, 2)}
                              {(r.remainingAmountUSD ?? 0) > 0.01 && (
                                <span style={{ color:ACC.amber }}>
                                  {" "}/ متبقي ${formatNumber(r.remainingAmountUSD ?? 0, 2)}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-xs shrink-0" style={{ color:"var(--text-muted)" }}>
                          {r.payment} · {r.convincedBy}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </motion.div>
  );
}
