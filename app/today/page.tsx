"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  RefreshCw, RotateCcw, Wallet, MessageCircle, CheckCircle2, Loader2,
  PhoneCall, Clock, CheckCheck, XCircle,
} from "lucide-react";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { useMarkContact } from "@/features/today/useMarkContact";
import { buildTodayTasks, whatsappNumber, type TaskItem, type TodayTasks } from "@/lib/todayTasks";
import type { RenewalWorkflowStatus } from "@/constants/subscriberWorkflow";

/**
 * The day's work, in the order a working day asks for it.
 *
 * Every other screen in this app answers "how are we doing?". None answered
 * "what should I do now?", which is the only question an employee has at 9am.
 * The data was always there — expiry dates, balances — it just had to be sorted
 * into jobs instead of totals.
 *
 * Scoping comes free: useSubscribers already restricts the query by permission,
 * so an employee sees their own book and an owner sees everything. Nothing here
 * needs its own access rule.
 */

const ACC = { amber: "#F59E0B", rose: "#EF4444", emerald: "#22C55E", indigo: "#5B5FEF" };

/** The outcomes worth recording from a call, in the order they actually happen. */
const OUTCOMES: { status: RenewalWorkflowStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: "contacted", label: "تم التواصل",  icon: <PhoneCall size={13} />,  color: "#7C3AED" },
  { status: "promised",  label: "وعد بالدفع",  icon: <Clock size={13} />,      color: "#2563EB" },
  { status: "renewed",   label: "تم التجديد",  icon: <CheckCheck size={13} />, color: "#059669" },
  { status: "declined",  label: "رفض التجديد", icon: <XCircle size={13} />,    color: "#DC2626" },
];

/** "$40" / "$25.45" — whole amounts stay whole, so the strip reads clean. */
function money(n: number) {
  return "$" + n.toFixed(n % 1 === 0 ? 0 : 2);
}

function OutcomeButton({
  label, icon, color, disabled, onClick,
}: { label: string; icon: React.ReactNode; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="shrink-0 w-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-40"
      style={{ height: 26, border: "none", background: "transparent", color: "var(--jk-subtle)" }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = color;
        e.currentTarget.style.background = `${color}18`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--jk-subtle)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

function TaskRow({
  item, accent, showOutcomes, last,
}: { item: TaskItem; accent: string; showOutcomes: boolean; last: boolean }) {
  const s = item.subscriber;
  const wa = whatsappNumber(s);
  const mark = useMarkContact();
  const busy = mark.isPending;

  return (
    <div
      className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl"
      style={{
        // No divider under the final row — a line that closes nothing reads as
        // a list that got cut off mid-way.
        borderBottom: last ? "1px solid transparent" : "1px solid var(--jk-divider)",
        // Dimmed rather than hidden: someone has spoken to them, but a promise
        // is not a payment and the row is still owed a follow-up.
        opacity: item.inProgress ? 0.55 : 1,
      }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: accent, boxShadow: `0 0 0 3px ${accent}22` }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <Link
          href={`/subscribers/${s.id}`}
          className="block truncate text-[13.5px] font-bold hover:underline"
          style={{ color: "var(--jk-text)" }}
        >
          {s.name}
        </Link>
        <span className="text-[11.5px]" style={{ color: "var(--jk-subtle)" }}>
          {item.amountUSD != null ? (
            <>
              {"متبقٍّ "}
              {/* Isolated so the currency sign stays left of the digits in RTL. */}
              <bdi dir="ltr">{money(item.amountUSD)}</bdi>
            </>
          ) : (
            item.reason
          )}
          {s.assignedSalesName ? ` · ${s.assignedSalesName}` : s.convincedBy ? ` · ${s.convincedBy}` : ""}
          {item.inProgress ? " · تمّت متابعته" : ""}
        </span>
      </div>

      {wa && (
        // The action, not a link to a screen that has the action. Chasing a
        // renewal is a WhatsApp message in this business, so that is the button.
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold"
          style={{ background: "var(--jk-active-bg)", color: "var(--jk-active)", border: "1px solid var(--jk-active-border)" }}
        >
          <MessageCircle size={13} />
          واتساب
        </a>
      )}

      {showOutcomes && (
        // One segmented control rather than four floating outlined squares.
        // Four equally-weighted boxes per row read as noise at a glance; a
        // single grouped strip reads as one thing you can act on.
        <div
          className="shrink-0 flex items-center rounded-lg p-0.5"
          style={{ background: "var(--jk-surface-hover)", border: "1px solid var(--jk-divider)" }}
        >
          {busy ? (
            // Same footprint as the four buttons, so the row does not jump
            // while the write is in flight.
            <span className="flex items-center justify-center" style={{ width: 112, height: 26 }}>
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--jk-subtle)" }} />
            </span>
          ) : (
            OUTCOMES.map((o) => (
              <OutcomeButton
                key={o.status}
                label={o.label}
                icon={o.icon}
                color={o.color}
                disabled={busy}
                onClick={() =>
                  mark.mutate({
                    subscriberId: s.id,
                    subscriberName: s.name,
                    renewalWorkflowStatus: o.status,
                  })
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TaskColumn({
  title, hint, items, accent, icon, emptyText, footNote, showOutcomes = false,
}: {
  title: string; hint: string; items: TaskItem[]; accent: string;
  icon: React.ReactNode; emptyText: string; footNote?: string; showOutcomes?: boolean;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--jk-border)", boxShadow: "var(--shadow-card)" }}
    >
      {/* A hairline of the column's colour, so the three cards are told apart
          before a word is read. */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} aria-hidden="true" />

      <header
        className="flex items-center gap-3 p-4"
        style={{ borderBottom: "1px solid var(--jk-divider)", background: `${accent}0A` }}
      >
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1F`, color: accent }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-extrabold" style={{ color: "var(--jk-text)" }}>{title}</h2>
          <p className="text-[11.5px]" style={{ color: "var(--jk-subtle)" }}>{hint}</p>
        </div>
        <span
          className="shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-extrabold tabular-nums"
          style={{ background: `${accent}1F`, color: accent }}
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
          <CheckCircle2 size={22} style={{ color: ACC.emerald }} />
          <p className="text-[12.5px]" style={{ color: "var(--jk-subtle)" }}>{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col p-1.5 max-h-[26rem] overflow-y-auto">
          {items.map((it, i) => (
            <TaskRow
              key={`${it.subscriber.id}-${it.reason}`}
              item={it}
              accent={accent}
              showOutcomes={showOutcomes}
              last={i === items.length - 1}
            />
          ))}
        </div>
      )}

      {footNote && items.length > 0 && (
        <div
          className="px-4 py-2.5 text-[11.5px] font-bold"
          style={{ borderTop: "1px solid var(--jk-divider)", color: "var(--jk-subtle)", background: "var(--jk-surface-hover)" }}
        >
          {footNote}
        </div>
      )}
    </section>
  );
}

/** One number with its label — the day at a glance, above the columns. */
function SummaryChip({
  label, value, accent, icon,
}: { label: string; value: React.ReactNode; accent: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2"
      style={{ background: "var(--surface)", border: "1px solid var(--jk-border)", boxShadow: "var(--shadow-card)" }}
    >
      <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}1F`, color: accent }}>
        {icon}
      </span>
      <span className="text-[15px] font-extrabold tabular-nums" style={{ color: "var(--jk-text)" }}>{value}</span>
      <span className="text-[11.5px]" style={{ color: "var(--jk-subtle)" }}>{label}</span>
    </div>
  );
}

export default function TodayPage() {
  const { user, can } = useAuthStore();
  const { subscribers, loading } = useSubscribers();
  const tasks: TodayTasks = buildTodayTasks(subscribers);
  const owed = tasks.collections.reduce((sum, t) => sum + (t.amountUSD ?? 0), 0);

  // Recording an outcome is a renewal action, the same bar the API enforces.
  // Without it the buttons would appear and then fail with a 403.
  const canRecord = can("canEdit");
  const greeting = user?.name ? `${user.name}` : "";

  return (
    <ProtectedLayout>
      <PageHeader
        title="مهام اليوم"
        subtitle={
          loading
            ? "جارٍ التحضير…"
            : tasks.total === 0
              ? "لا شيء عاجل اليوم — دفترك مرتّب"
              : `${tasks.total} مهمة تنتظرك${greeting ? "، " + greeting : ""}`
        }
      >
        {/* The counts live beside the title instead of only inside each card,
            so the shape of the day is readable without scanning three lists —
            and the header's empty half now carries something. */}
        {!loading && tasks.total > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <SummaryChip label="تجديد" value={tasks.renewals.length} accent={ACC.amber} icon={<RefreshCw size={14} />} />
            <SummaryChip label="استرجاع" value={tasks.winBack.length} accent={ACC.rose} icon={<RotateCcw size={14} />} />
            <SummaryChip label="تحصيل" value={tasks.collections.length} accent={ACC.indigo} icon={<Wallet size={14} />} />
            {owed > 0 && (
              <SummaryChip
                label="رصيد مفتوح"
                value={<bdi dir="ltr">{money(owed)}</bdi>}
                accent={ACC.emerald}
                icon={<Wallet size={14} />}
              />
            )}
          </div>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20" style={{ color: "var(--jk-subtle)" }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">جارٍ تحميل المهام…</span>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          // items-start: each card hugs its own content. Stretching three
          // unequal lists to a single height left the short ones half empty,
          // which is most of what made the screen look scattered.
          className="grid gap-4 items-start md:grid-cols-2 xl:grid-cols-3"
        >
          <TaskColumn
            title="تجديدات هذا الأسبوع"
            hint="اتصل قبل أن ينتهي — الأرخص دائماً"
            items={tasks.renewals}
            accent={ACC.amber}
            icon={<RefreshCw size={17} />}
            emptyText="لا اشتراك ينتهي خلال الأسبوع"
            showOutcomes={canRecord}
          />
          <TaskColumn
            title="انتهوا حديثاً"
            hint="خلال آخر ٣٠ يوماً — ما زالوا قابلين للاسترجاع"
            items={tasks.winBack}
            accent={ACC.rose}
            icon={<RotateCcw size={17} />}
            emptyText="لا أحد انتهى اشتراكه هذا الشهر"
            showOutcomes={canRecord}
          />
          <TaskColumn
            title="عليهم رصيد"
            hint="الأكبر مبلغاً أولاً"
            items={tasks.collections}
            accent={ACC.indigo}
            icon={<Wallet size={17} />}
            emptyText="لا مستحقات مفتوحة"
            footNote={owed > 0 ? `إجمالي المستحق: ${money(owed)}` : undefined}
          />
        </motion.div>
      )}
    </ProtectedLayout>
  );
}
