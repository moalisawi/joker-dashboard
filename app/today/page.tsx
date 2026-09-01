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
import { buildTodayTasks, whatsappNumber, type TaskItem } from "@/lib/todayTasks";
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
      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
      style={{ border: "1px solid var(--jk-divider)", background: "transparent", color: "var(--jk-subtle)" }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = color;
        e.currentTarget.style.borderColor = `${color}55`;
        e.currentTarget.style.background = `${color}14`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--jk-subtle)";
        e.currentTarget.style.borderColor = "var(--jk-divider)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

function TaskRow({
  item, accent, showOutcomes,
}: { item: TaskItem; accent: string; showOutcomes: boolean }) {
  const s = item.subscriber;
  const wa = whatsappNumber(s);
  const mark = useMarkContact();
  const busy = mark.isPending;

  return (
    <div
      className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl"
      style={{
        borderBottom: "1px solid var(--jk-divider)",
        // Dimmed rather than hidden: someone has spoken to them, but a promise
        // is not a payment and the row is still owed a follow-up.
        opacity: item.inProgress ? 0.55 : 1,
      }}
    >
      <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, background: accent }} aria-hidden="true" />

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
              <bdi dir="ltr">{"$" + item.amountUSD.toFixed(item.amountUSD % 1 === 0 ? 0 : 2)}</bdi>
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
        <div className="shrink-0 flex items-center gap-1">
          {busy ? (
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--jk-subtle)" }} />
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
  title, hint, items, accent, icon, emptyText, showOutcomes = false,
}: {
  title: string; hint: string; items: TaskItem[]; accent: string;
  icon: React.ReactNode; emptyText: string; showOutcomes?: boolean;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--jk-border)", boxShadow: "var(--shadow-card)" }}
    >
      <header className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--jk-divider)" }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18`, color: accent }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-extrabold" style={{ color: "var(--jk-text)" }}>{title}</h2>
          <p className="text-[11.5px]" style={{ color: "var(--jk-subtle)" }}>{hint}</p>
        </div>
        <span
          className="shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-extrabold tabular-nums"
          style={{ background: `${accent}18`, color: accent }}
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
          {items.map((it) => (
            <TaskRow key={`${it.subscriber.id}-${it.reason}`} item={it} accent={accent} showOutcomes={showOutcomes} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function TodayPage() {
  const { user, can } = useAuthStore();
  const { subscribers, loading } = useSubscribers();
  const tasks = buildTodayTasks(subscribers);

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
      />

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
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
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
          />
        </motion.div>
      )}
    </ProtectedLayout>
  );
}
