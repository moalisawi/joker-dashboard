"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText, CalendarClock, AlertTriangle, CheckCircle2, Wallet,
  Layers, Info, Plus,
} from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { useBillingOverview } from "@/features/billing/hooks";
import { canCreatePayments } from "@/lib/permissionGuards";
import {
  legacyToCurrentCycleView,
  deriveBillingStatus,
  deriveInstallmentStatus,
  summarizeAging,
  agingBucketFor,
  AGING_BUCKET_LABELS,
} from "@/lib/subscriberLifecycle";
import {
  INVOICE_STATUS_LABELS, INSTALLMENT_STATUS_LABELS, CYCLE_STATUS_LABELS,
} from "@/types/billing";
import type { InstallmentStatus, InvoiceStatus } from "@/types/billing";
import { formatNumber, formatDate, todayString } from "@/lib/utils";
import type { Subscriber } from "@/types";

const ACC = { indigo: "#5B5FEF", emerald: "#22C55E", amber: "#F59E0B", rose: "#EF4444", sky: "#3B82F6", muted: "#9CA3AF" };

const INVOICE_COLOR: Record<InvoiceStatus, string> = {
  draft: ACC.muted, issued: ACC.sky, partially_paid: ACC.amber,
  paid: ACC.emerald, overdue: ACC.rose, void: ACC.muted, refunded: ACC.rose,
};

const INSTALLMENT_COLOR: Record<InstallmentStatus, string> = {
  pending: ACC.sky, partially_paid: ACC.amber, paid: ACC.emerald,
  overdue: ACC.rose, waived: ACC.muted, cancelled: ACC.muted,
};

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function Panel({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{title}</span>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-base font-black tabular-nums" style={{ color: accent ?? "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

interface Props {
  subscriber: Subscriber;
  onAddPayment: () => void;
  canRev: boolean;
}

/**
 * Billing for one subscriber: the current cycle, what it was invoiced for, and
 * when each remaining slice falls due.
 *
 * Renders from the ledger when there is one and from the subscriber's summary
 * fields when there is not — which is every record created before the ledger
 * existed. The fallback is labelled rather than disguised: a reconstructed view
 * has no invoice number and no schedule behind it, and showing a confident
 * "غير مقسّط" for a subscriber nobody ever built a plan for would be a claim the
 * data does not support.
 */
export default function BillingTab({ subscriber: s, onAddPayment, canRev }: Props) {
  const { user } = useAuthStore();
  const canPay = canCreatePayments(user) || user?.role === "owner" || user?.role === "admin";
  const today = todayString();

  const { currentCycle, currentInvoice, installments, cycles, hasLedger, isLoading, isError } =
    useBillingOverview(s as unknown as { id: string; currentCycleId?: string | null; currentInvoiceId?: string | null });

  /**
   * Three different reasons the ledger can be absent, and they must not be
   * reported as one.
   *
   * `firestore.rules` denies unknown collections by default, so until the new
   * rules are deployed every ledger read comes back permission-denied — for the
   * owner too. The subscriber document still says `currentCycleId`, so blaming
   * the subscriber's age would be a confident lie about a deployment problem.
   */
  const ledgerState: "ok" | "denied" | "legacy" =
    isError ? "denied"
    : hasLedger ? "ok"
    : s.currentCycleId ? "denied"
    : "legacy";

  const view = useMemo(
    () => legacyToCurrentCycleView(s as unknown as Record<string, unknown>, currentCycle),
    [s, currentCycle]
  );

  const invoiceStatus: InvoiceStatus = currentInvoice
    ? (currentInvoice.status as InvoiceStatus)
    : deriveBillingStatus(
        { totalUSD: view.totalPriceUSD, paidUSD: view.paidAmountUSD, refundedUSD: view.refundAmountUSD, dueDate: view.expiryDate },
        today
      );

  const aging = useMemo(() => summarizeAging(installments, today), [installments, today]);
  const agingRows = (Object.keys(AGING_BUCKET_LABELS) as (keyof typeof AGING_BUCKET_LABELS)[])
    .filter((k) => aging[k].count > 0);

  const nextDue = useMemo(
    () =>
      installments
        .filter((i) => i.status !== "paid" && i.status !== "waived" && i.status !== "cancelled")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
    [installments]
  );

  const overdueTotal = aging.d1_7.amountUSD + aging.d8_30.amountUSD + aging.d31_plus.amountUSD + aging.due_today.amountUSD;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[120, 200, 160].map((h, i) => (
          <div key={i} className="rounded-2xl" style={{ height: h, background: "var(--surface)" }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-4">

      {/* ── Current cycle ── */}
      <Panel
        title={`الدورة الحالية — #${view.cycleNumber}`}
        icon={<Layers size={15} style={{ color: ACC.indigo }} />}
        action={
          currentCycle ? (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: `${ACC.indigo}15`, color: ACC.indigo }}
            >
              {CYCLE_STATUS_LABELS[currentCycle.status]}
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="الباقة" value={view.package || "—"} />
          <Stat label="يبدأ" value={view.startDate ? formatDate(view.startDate) : "—"} />
          <Stat label="ينتهي" value={view.expiryDate ? formatDate(view.expiryDate) : "—"} />
          <Stat label="المدة" value={view.duration ? `${view.duration} يوم` : "—"} />
        </div>

        {canRev && (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-4 pt-4 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <Stat label="إجمالي الدورة" value={`$${formatNumber(view.totalPriceUSD, 2)}`} />
            <Stat label="المدفوع" value={`$${formatNumber(view.paidAmountUSD, 2)}`} accent={ACC.emerald} />
            <Stat
              label="المتبقي"
              value={`$${formatNumber(view.remainingAmountUSD, 2)}`}
              accent={view.remainingAmountUSD > 0.01 ? ACC.amber : ACC.emerald}
            />
            <Stat
              label="المُسترد"
              value={view.refundAmountUSD > 0 ? `-$${formatNumber(view.refundAmountUSD, 2)}` : "—"}
              accent={view.refundAmountUSD > 0 ? ACC.rose : undefined}
            />
          </div>
        )}

        {ledgerState === "legacy" && (
          <div
            className="flex items-start gap-2 rounded-xl p-3 mt-4 text-xs"
            style={{ background: `${ACC.sky}10`, border: `1px solid ${ACC.sky}30`, color: "var(--text-secondary)" }}
          >
            <Info size={14} style={{ color: ACC.sky }} className="shrink-0 mt-0.5" />
            <span>
              هذا المشترك يسبق نظام الفواتير — الأرقام أعلاه محسوبة من ملخّص المشترك مباشرة.
              لا توجد فاتورة أو جدول أقساط محفوظ له، وسيُنشأ كلاهما تلقائياً عند أول تجديد.
            </span>
          </div>
        )}

        {ledgerState === "denied" && (
          <div
            className="flex items-start gap-2 rounded-xl p-3 mt-4 text-xs"
            style={{ background: `${ACC.amber}10`, border: `1px solid ${ACC.amber}30`, color: "var(--text-secondary)" }}
          >
            <AlertTriangle size={14} style={{ color: ACC.amber }} className="shrink-0 mt-0.5" />
            <span>
              لهذا المشترك فاتورة محفوظة لكن تعذّر قراءتها. الأرقام أعلاه من ملخّص المشترك وهي صحيحة،
              لكن جدول الأقساط غير ظاهر — الأرجح أن قواعد Firestore الجديدة لم تُنشر بعد.
            </span>
          </div>
        )}
      </Panel>

      {/* ── Invoice ── */}
      <Panel
        title="الفاتورة"
        icon={<FileText size={15} style={{ color: INVOICE_COLOR[invoiceStatus] }} />}
        action={
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${INVOICE_COLOR[invoiceStatus]}15`, color: INVOICE_COLOR[invoiceStatus] }}
          >
            {INVOICE_STATUS_LABELS[invoiceStatus]}
          </span>
        }
      >
        {currentInvoice ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="رقم الفاتورة" value={currentInvoice.invoiceNumber} />
            <Stat label="تاريخ الإصدار" value={formatDate(currentInvoice.issueDate)} />
            <Stat label="تاريخ الاستحقاق" value={formatDate(currentInvoice.dueDate)} />
            <Stat
              label="الخطة"
              value={currentInvoice.paymentPlanType === "installments"
                ? `${currentInvoice.installmentCount} أقساط`
                : "دفعة واحدة"}
            />
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            لا توجد فاتورة محفوظة لهذه الدورة — الحالة أعلاه محسوبة من رصيد المشترك.
          </p>
        )}
      </Panel>

      {/* ── Instalments ── */}
      <Panel
        title="جدول الأقساط"
        icon={<CalendarClock size={15} style={{ color: ACC.amber }} />}
        action={
          canPay ? (
            <button
              onClick={onAddPayment}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white"
              style={{ background: ACC.indigo }}
            >
              <Plus size={12} /> تسجيل دفعة
            </button>
          ) : undefined
        }
      >
        {installments.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {currentInvoice?.paymentPlanType === "installments"
              ? "لم تُنشأ أقساط لهذه الفاتورة."
              : "هذه الدورة غير مقسّطة — المبلغ مستحق دفعة واحدة."}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
                  {["#", "الاستحقاق", "المبلغ", "المدفوع", "المتبقي", "الحالة", "التقادم"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {installments.map((inst) => {
                  // Recomputed against today rather than trusted from the
                  // document: an instalment stored as "pending" becomes overdue
                  // by the passage of time, and nothing rewrites it nightly.
                  const status = deriveInstallmentStatus(inst, today);
                  const outstanding = Math.max(0, inst.amountUSD - inst.paidUSD);
                  const bucket = agingBucketFor(inst.dueDate, today);
                  return (
                    <tr key={inst.id} style={{ borderTop: "1px solid var(--divider)" }}>
                      <td className="px-4 py-2.5 font-bold" style={{ color: "var(--text-secondary)" }}>
                        {inst.installmentNumber}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        {formatDate(inst.dueDate)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                        {canRev ? `$${formatNumber(inst.amountUSD, 2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: ACC.emerald }}>
                        {canRev ? `$${formatNumber(inst.paidUSD, 2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: outstanding > 0 ? ACC.amber : "var(--text-muted)" }}>
                        {canRev ? `$${formatNumber(outstanding, 2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${INSTALLMENT_COLOR[status]}15`, color: INSTALLMENT_COLOR[status] }}
                        >
                          {INSTALLMENT_STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {status === "paid" ? "—" : AGING_BUCKET_LABELS[bucket]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Next due / overdue ── */}
      {nextDue && (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: overdueTotal > 0 ? `${ACC.rose}10` : `${ACC.sky}10`,
            border: `1px solid ${overdueTotal > 0 ? ACC.rose : ACC.sky}30`,
          }}
        >
          {overdueTotal > 0
            ? <AlertTriangle size={16} style={{ color: ACC.rose, marginTop: 1 }} />
            : <CalendarClock size={16} style={{ color: ACC.sky, marginTop: 1 }} />}
          <div>
            <p className="text-sm font-bold" style={{ color: overdueTotal > 0 ? ACC.rose : ACC.sky }}>
              القسط القادم #{nextDue.installmentNumber} — {formatDate(nextDue.dueDate)}
              {canRev ? ` · $${formatNumber(Math.max(0, nextDue.amountUSD - nextDue.paidUSD), 2)}` : ""}
            </p>
            {overdueTotal > 0 && canRev && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                إجمالي المتأخر: ${formatNumber(overdueTotal, 2)}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── AR aging ── */}
      {canRev && agingRows.length > 0 && (
        <Panel title="تقادم المستحقات" icon={<Wallet size={15} style={{ color: ACC.rose }} />}>
          <div className="space-y-1.5">
            {agingRows.map((k) => (
              <div key={k} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: "var(--divider)" }}>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {AGING_BUCKET_LABELS[k]}
                  <span className="mr-2 opacity-60">({aging[k].count})</span>
                </span>
                <span className="text-xs font-black tabular-nums" style={{ color: k === "not_due" ? "var(--text-muted)" : ACC.rose }}>
                  ${formatNumber(aging[k].amountUSD, 2)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Past cycles ── */}
      {cycles.length > 1 && (
        <Panel title="الدورات السابقة" icon={<CheckCircle2 size={15} style={{ color: ACC.muted }} />}>
          <div className="space-y-1.5">
            {cycles
              .filter((c) => c.id !== currentCycle?.id)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                  style={{ borderColor: "var(--divider)" }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      دورة #{c.cycleNumber} · {c.package || "—"}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {formatDate(c.startDate)} — {formatDate(c.expiryDate)} · {CYCLE_STATUS_LABELS[c.status]}
                    </p>
                  </div>
                  {canRev && (
                    <span className="text-xs font-bold tabular-nums" style={{ color: ACC.emerald }}>
                      ${formatNumber(c.paidAmountUSD, 2)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </Panel>
      )}
    </motion.div>
  );
}
