"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign, RefreshCw, StickyNote, UserCheck,
  PauseCircle, Snowflake, UserMinus,
  Plus, RotateCcw, AlertCircle, PlayCircle,
} from "lucide-react";
import { useSubscriberNotes } from "@/features/subscriberNotes/hooks/useSubscriberNotes";
import { formatNumber } from "@/lib/utils";
import type { Subscriber }        from "@/types";
import type { PaymentTransaction } from "@/types";
import type { RefundTransaction }  from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind =
  | "created"    | "payment"  | "refund"   | "renewal"
  | "paused"     | "resumed"  | "frozen"   | "unfrozen"
  | "withdrawn"  | "assigned" | "note";

interface TimelineEvent {
  id:      string;
  kind:    EventKind;
  date:    string;   // ISO date string for sorting
  label:   string;   // title
  sub?:    string;   // secondary text
  amount?: number;   // USD amount if financial
  color:   string;
  icon:    React.ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString();
  return String(raw);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

const ACC = {
  indigo:  "#5B5FEF",
  emerald: "#5B5FEF",
  amber:   "#F59E0B",
  rose:    "#EF4444",
  sky:     "#3B82F6",
  violet:  "#3B82F6",
  orange:  "#F59E0B",
  teal:    "#5B5FEF",
  slate:   "#6b7280",
};

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.04 } } };

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  subscriber: Subscriber;
  payments:   PaymentTransaction[];
  refunds:    RefundTransaction[];
  canRev:     boolean;
}

export default function TimelineTab({ subscriber: s, payments, refunds, canRev }: Props) {
  const t = { card: "var(--surface)", border: "rgba(15,23,42,0.08)", t1: "var(--text-primary)", t2: "#6b7280", line: "rgba(15,23,42,0.08)" };

  const { data: notes = [] } = useSubscriberNotes(s.id);

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // 1. Created
    list.push({
      id:    "created",
      kind:  "created",
      date:  toIso(s.createdAt) || s.date || "",
      label: "تسجيل الاشتراك",
      sub:   `${s.package} · ${s.duration}`,
      color: ACC.indigo,
      icon:  <Plus size={13} />,
    });

    // 2. Payments
    payments.forEach((p) => {
      const isRenewal = p.isRenewalPayment === true;
      list.push({
        id:     `pay-${p.id}`,
        kind:   isRenewal ? "renewal" : "payment",
        date:   toIso(p.createdAt) || p.date || "",
        label:  isRenewal ? `دفعة تجديد #${p.renewalNumber ?? ""}` : "دفعة",
        sub:    p.paymentMethod ?? "",
        amount: p.amountUSD,
        color:  isRenewal ? ACC.violet : ACC.emerald,
        icon:   isRenewal ? <RotateCcw size={13} /> : <DollarSign size={13} />,
      });
    });

    // 3. Refunds
    refunds.forEach((r) => {
      list.push({
        id:     `ref-${r.id}`,
        kind:   "refund",
        date:   toIso(r.createdAt) || r.refundDate || "",
        label:  "استرداد",
        sub:    r.refundReason ?? "",
        amount: r.refundAmountUSD,
        color:  ACC.rose,
        icon:   <RefreshCw size={13} />,
      });
    });

    // 4. Renewals (from renewals array on subscriber)
    (s.renewals ?? []).forEach((r, i) => {
      const alreadyCounted = payments.some(
        (p) => p.isRenewalPayment && p.renewalNumber === i + 1
      );
      if (!alreadyCounted) {
        list.push({
          id:    `renew-${i}`,
          kind:  "renewal",
          date:  toIso(r.renewedAt) || r.startDate || "",
          label: `تجديد #${i + 1}`,
          sub:   r.package ? `${r.package} · ${r.duration ?? ""}` : "",
          color: ACC.violet,
          icon:  <RotateCcw size={13} />,
        });
      }
    });

    // 5. Paused
    if (s.pausedAt) {
      list.push({
        id:    "paused",
        kind:  "paused",
        date:  toIso(s.pausedAt),
        label: "إيقاف مؤقت للاشتراك",
        sub:   (s as unknown as { pausedBy?: string }).pausedBy ?? "",
        color: ACC.orange,
        icon:  <PauseCircle size={13} />,
      });
    }

    // 6. Frozen / unfrozen
    if (s.freezeData?.frozenAt) {
      list.push({
        id:    "frozen",
        kind:  "frozen",
        date:  toIso(s.freezeData.frozenAt),
        label: "تجميد الاشتراك",
        sub:   s.freezeData.frozenBy ?? "",
        color: ACC.sky,
        icon:  <Snowflake size={13} />,
      });
    }
    if (s.freezeData?.resumedAt) {
      list.push({
        id:    "unfrozen",
        kind:  "unfrozen",
        date:  toIso(s.freezeData.resumedAt),
        label: "رفع التجميد",
        color: ACC.teal,
        icon:  <PlayCircle size={13} />,
      });
    }

    // 7. Withdrawal
    if (s.withdrawalData?.withdrawnAt) {
      list.push({
        id:    "withdrawn",
        kind:  "withdrawn",
        date:  toIso(s.withdrawalData.withdrawnAt),
        label: "انسحاب من الاشتراك",
        sub:   s.withdrawalData.refundIssued ? "مع استرداد" : "بدون استرداد",
        color: ACC.rose,
        icon:  <UserMinus size={13} />,
      });
    }

    // 8. Assignment changes (typed per AssignmentHistoryEntry)
    (s.assignmentHistory ?? []).forEach((a, i) => {
      const toName =
        a.assignedSalesName ??
        a.assignedNutritionistName ??
        a.assignedTeamName ??
        a.actorName ?? "";
      list.push({
        id:    `assign-${i}`,
        kind:  "assigned",
        date:  toIso(a.timestamp),
        label: "تغيير التعيين",
        sub:   [toName, a.reason].filter(Boolean).join(" · "),
        color: ACC.amber,
        icon:  <UserCheck size={13} />,
      });
    });

    // 9. Notes
    notes.forEach((n) => {
      list.push({
        id:    `note-${n.id}`,
        kind:  "note",
        date:  toIso(n.createdAt),
        label: "ملاحظة",
        sub:   n.content?.slice(0, 60) + (n.content?.length > 60 ? "…" : ""),
        color: ACC.slate,
        icon:  <StickyNote size={13} />,
      });
    });

    // Sort descending (newest first)
    return list
      .filter((e) => !!e.date)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [s, payments, refunds, notes]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <AlertCircle size={36} style={{ color: ACC.slate, opacity: 0.4 }} />
        <p className="text-sm" style={{ color: t.t2 }}>لا توجد أحداث مسجلة</p>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden" animate="show" variants={stagger}
      className="py-6 space-y-0 relative"
    >
      {/* Vertical line */}
      <div
        className="absolute right-[27px] top-6 bottom-6 w-px"
        style={{ background: t.line }}
      />

      {events.map((ev, idx) => (
        <motion.div
          key={ev.id}
          variants={fadeUp}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative flex items-start gap-4 pb-6 pr-2"
        >
          {/* Icon dot */}
          <div
            className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
            style={{
              background: `${ev.color}18`,
              borderColor: `${ev.color}40`,
              color: ev.color,
            }}
          >
            {ev.icon}
          </div>

          {/* Content */}
          <div
            className="flex-1 rounded-2xl px-4 py-3"
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold" style={{ color: t.t1 }}>{ev.label}</p>
              <div className="flex items-center gap-2 shrink-0">
                {canRev && ev.amount !== undefined && ev.amount > 0 && (
                  <span
                    className="text-xs font-black tabular-nums px-2 py-0.5 rounded-full"
                    style={{ background: `${ev.color}15`, color: ev.color }}
                  >
                    {ev.kind === "refund" ? "-" : "+"}${formatNumber(ev.amount, 2)}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: t.t2 }}>
                  {fmtDate(ev.date)}
                </span>
              </div>
            </div>
            {ev.sub && (
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: t.t2 }}>{ev.sub}</p>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
