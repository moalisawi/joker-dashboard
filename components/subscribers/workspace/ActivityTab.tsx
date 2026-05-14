"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSubscriberNotes }     from "@/features/subscriberNotes";
import { useAssignmentHistory }   from "@/features/subscriberAssignments";
import { usePayments }            from "@/hooks/usePayments";
import { useRefunds }             from "@/hooks/useRefunds";
import {
  NOTE_TYPE_COLORS, NOTE_TYPE_LABELS,
  ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPE,
} from "@/constants/subscriberWorkflow";
import { formatNumber } from "@/lib/utils";
import type { Subscriber } from "@/types";
import {
  StickyNote, UserCheck, DollarSign, RotateCcw,
  Filter, Clock, User,
} from "lucide-react";

const ACC = { indigo:"#6366f1", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8" };
const fadeUp = { hidden:{opacity:0,y:8}, show:{opacity:1,y:0} };
const tran   = { duration:0.25, ease:"easeOut" } as const;
const stagger = { show:{transition:{staggerChildren:0.03}} };

type EventType = "note" | "assignment" | "payment" | "refund";

interface TimelineEvent {
  id:        string;
  type:      EventType;
  timestamp: Date;
  actor:     string;
  title:     string;
  body?:     string;
  accent:    string;
  badge?:    string;
}

function toDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "string") return new Date(raw);
  if (typeof (raw as {toDate?():Date}).toDate === "function")
    return (raw as {toDate():Date}).toDate();
  if (typeof raw === "number") return new Date(raw);
  return null;
}

function fmtTs(d: Date): string {
  return d.toLocaleDateString("ar-SA", {
    day:"numeric", month:"short", year:"numeric",
    hour:"2-digit", minute:"2-digit",
  });
}

function EventIcon({ type, accent }: { type: EventType; accent: string }) {
  const IconMap = {
    note:       <StickyNote size={12}/>,
    assignment: <UserCheck  size={12}/>,
    payment:    <DollarSign size={12}/>,
    refund:     <RotateCcw  size={12}/>,
  };
  return (
    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
      style={{ background:`${accent}18`, border:`1px solid ${accent}30` }}>
      <span style={{ color:accent }}>{IconMap[type]}</span>
    </div>
  );
}

function EventCard({ event }: { event: TimelineEvent }) {
  return (
    <motion.div variants={fadeUp} transition={tran} className="flex items-start gap-3 py-3 border-b last:border-0"
      style={{ borderColor:"var(--divider)" }}>
      <EventIcon type={event.type} accent={event.accent}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {event.badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background:`${event.accent}18`, color:event.accent }}>
              {event.badge}
            </span>
          )}
          <p className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>
            {event.title}
          </p>
        </div>
        {event.body && (
          <p className="text-[11px] mb-0.5 line-clamp-2" style={{ color:"var(--text-secondary)" }}>
            {event.body}
          </p>
        )}
        <p className="text-[10px] flex items-center gap-1" style={{ color:"var(--text-muted)" }}>
          <Clock size={9}/>{fmtTs(event.timestamp)}
          {event.actor && <><span>·</span><User size={9}/>{event.actor}</>}
        </p>
      </div>
    </motion.div>
  );
}

const FILTERS: { key: EventType | "all"; label: string }[] = [
  { key:"all",        label:"الكل" },
  { key:"note",       label:"ملاحظات" },
  { key:"assignment", label:"تعيين" },
  { key:"payment",    label:"دفعات" },
  { key:"refund",     label:"استردادات" },
];

const PAGE_SIZE = 20;

interface Props {
  subscriber: Subscriber;
  canRev:     boolean;
}

export default function ActivityTab({ subscriber: s, canRev }: Props) {
  const { data: notes = [], isLoading: nLoad }         = useSubscriberNotes(s.id);
  const { data: history = [], isLoading: hLoad }       = useAssignmentHistory(s.id);
  const { payments, loading: pLoad }                   = usePayments({ subscriberId: s.id });
  const { refunds, loading: rLoad }                    = useRefunds({ subscriberId: s.id });

  const [filter, setFilter]   = useState<EventType | "all">("all");
  const [page, setPage]       = useState(1);

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // Notes
    for (const n of notes) {
      const ts = toDate(n.createdAt);
      if (!ts) continue;
      list.push({
        id:        `note-${n.id}`,
        type:      "note",
        timestamp: ts,
        actor:     n.authorName ?? "",
        title:     `ملاحظة ${NOTE_TYPE_LABELS[n.noteType] ?? ""}`,
        body:      n.content,
        accent:    NOTE_TYPE_COLORS[n.noteType] ?? "#64748b",
        badge:     NOTE_TYPE_LABELS[n.noteType],
      });
    }

    // Assignment history
    for (const h of history) {
      const ts = toDate(h.createdAt);
      if (!ts) continue;
      const from = h.fromEmployeeName ?? h.fromTeamName ?? ASSIGNMENT_TYPE_LABELS[h.fromAssignmentType ?? ASSIGNMENT_TYPE.UNASSIGNED];
      const to   = h.toEmployeeName   ?? h.toTeamName   ?? ASSIGNMENT_TYPE_LABELS[h.toAssignmentType];
      list.push({
        id:        `asgn-${ts.getTime()}-${h.transferredBy}`,
        type:      "assignment",
        timestamp: ts,
        actor:     h.transferredByName,
        title:     `نقل التعيين: ${from} → ${to}`,
        body:      h.reason,
        accent:    ACC.indigo,
        badge:     "تعيين",
      });
    }

    // Payments
    for (const p of payments) {
      const ts = toDate(p.date);
      if (!ts) continue;
      const typeLabel = p.isInitialPayment ? "أولية" : p.isRenewalPayment ? "تجديد" : "دفعة";
      list.push({
        id:        `pay-${p.id}`,
        type:      "payment",
        timestamp: ts,
        actor:     "",
        title:     `دفعة ${typeLabel}${canRev ? ` · $${formatNumber(p.amountUSD, 2)}` : ""}`,
        body:      p.paymentMethod ? `طريقة الدفع: ${p.paymentMethod}` : undefined,
        accent:    ACC.emerald,
        badge:     typeLabel,
      });
    }

    // Refunds
    for (const r of refunds) {
      const ts = toDate(r.refundDate);
      if (!ts) continue;
      list.push({
        id:        `ref-${r.id}`,
        type:      "refund",
        timestamp: ts,
        actor:     "",
        title:     `استرداد${canRev ? ` · $${formatNumber(r.refundAmountUSD, 2)}` : ""}`,
        body:      r.refundReason,
        accent:    ACC.rose,
        badge:     "استرداد",
      });
    }

    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [notes, history, payments, refunds, canRev]);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
  const visible  = filtered.slice(0, page * PAGE_SIZE);
  const hasMore  = visible.length < filtered.length;

  const isLoading = nLoad || hLoad || pLoad || rLoad;

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-4">

      {/* ── Filter chips ── */}
      <motion.div variants={fadeUp} transition={tran} className="flex flex-wrap gap-2 items-center">
        <Filter size={13} style={{ color:"var(--text-muted)" }}/>
        {FILTERS.map(({ key, label }) => {
          const count = key === "all"
            ? events.length
            : events.filter((e) => e.type === key).length;
          return (
            <button key={key}
              onClick={() => { setFilter(key); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: filter === key ? `${ACC.indigo}18` : "var(--surface-2)",
                color:      filter === key ? ACC.indigo : "var(--text-muted)",
                border:     `1px solid ${filter === key ? ACC.indigo + "40" : "var(--border)"}`,
              }}>
              {label}
              {count > 0 && (
                <span className="text-[10px]" style={{ opacity:0.7 }}>({count})</span>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* ── Timeline ── */}
      <motion.div variants={fadeUp} transition={tran}
        className="rounded-2xl overflow-hidden"
        style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
              سجل النشاط
            </span>
            <span className="text-[11px]" style={{ color:"var(--text-muted)" }}>
              {filtered.length} حدث
            </span>
          </div>
        </div>

        <div className="px-5 py-3">
          {isLoading ? (
            <div className="space-y-4 animate-pulse py-2">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full shrink-0" style={{ background:"var(--surface-2)" }}/>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded-full w-2/3" style={{ background:"var(--surface-2)" }}/>
                    <div className="h-3 rounded-full w-1/3" style={{ background:"var(--surface-2)" }}/>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color:"var(--text-muted)" }}>
              لا توجد أحداث
            </p>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger}>
              {visible.map((event) => (
                <EventCard key={event.id} event={event}/>
              ))}
            </motion.div>
          )}
        </div>

        {hasMore && (
          <div className="px-5 pb-4">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)", border:"1px solid var(--border)" }}>
              تحميل المزيد ({filtered.length - visible.length} حدث)
            </button>
          </div>
        )}
      </motion.div>

    </motion.div>
  );
}
