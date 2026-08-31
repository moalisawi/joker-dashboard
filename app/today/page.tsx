"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RefreshCw, RotateCcw, Wallet, MessageCircle, CheckCircle2, Loader2 } from "lucide-react";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { buildTodayTasks, whatsappNumber, type TaskItem } from "@/lib/todayTasks";

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

function TaskRow({ item, accent }: { item: TaskItem; accent: string }) {
  const s = item.subscriber;
  const wa = whatsappNumber(s);
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
      style={{ borderBottom: "1px solid var(--jk-divider)" }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: accent }}
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
          {item.reason}
          {s.assignedSalesName ? ` · ${s.assignedSalesName}` : s.convincedBy ? ` · ${s.convincedBy}` : ""}
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
    </div>
  );
}

function TaskColumn({
  title, hint, items, accent, icon, emptyText,
}: {
  title: string; hint: string; items: TaskItem[]; accent: string;
  icon: React.ReactNode; emptyText: string;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--jk-border)", boxShadow: "var(--shadow-card)" }}
    >
      <header className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--jk-divider)" }}>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
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
            <TaskRow key={`${it.subscriber.id}-${it.reason}`} item={it} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function TodayPage() {
  const { user } = useAuthStore();
  const { subscribers, loading } = useSubscribers();
  const tasks = buildTodayTasks(subscribers);

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
          />
          <TaskColumn
            title="انتهوا حديثاً"
            hint="خلال آخر ٣٠ يوماً — ما زالوا قابلين للاسترجاع"
            items={tasks.winBack}
            accent={ACC.rose}
            icon={<RotateCcw size={17} />}
            emptyText="لا أحد انتهى اشتراكه هذا الشهر"
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
