"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet, AlertTriangle, TrendingUp, RotateCcw, CreditCard, Receipt,
  RefreshCw, Scale, Loader2, FileText,
} from "lucide-react";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import ReconcileModal from "@/components/finance/ReconcileModal";

import { useAuthStore } from "@/store/authStore";
import { useFinancialReports } from "@/features/billing/useFinancialReports";
import { canViewRevenue, canReviewPayments } from "@/lib/permissionGuards";
import { AGING_BUCKET_LABELS, agingBucketFor, type AgingBucket } from "@/lib/subscriberLifecycle";
import { INVOICE_STATUS_LABELS } from "@/types/billing";
import type { InvoiceStatus } from "@/types/billing";
import { formatNumber, formatDate, todayString } from "@/lib/utils";

const ACC = { indigo: "#5B5FEF", emerald: "#22C55E", amber: "#F59E0B", rose: "#EF4444", sky: "#3B82F6", muted: "#9CA3AF" };

const BUCKET_COLOR: Record<AgingBucket, string> = {
  not_due: ACC.muted, due_today: ACC.amber, d1_7: ACC.amber, d8_30: ACC.rose, d31_plus: ACC.rose,
};

function Kpi({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="text-lg font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function Panel({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{title}</span>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * The money, across every subscriber at once.
 *
 * The per-subscriber billing tab answers "what does this person owe". Nothing
 * answered "what does the business have outstanding, how old is it, and how much
 * of what we billed have we actually collected" — those were spreadsheet
 * questions. Every figure here derives from the same helpers the subscriber tab
 * uses, so the two can never disagree.
 *
 * Gated on analytics.view: this is the whole revenue picture, which is exactly
 * what canViewRevenue exists to gate.
 */
export default function FinancePage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const mayView = canViewRevenue(user) || user?.role === "owner" || user?.role === "admin";
  const mayReconcile = canReviewPayments(user);

  const today = todayString();
  const r = useFinancialReports(mayView);

  const [reconcileFor, setReconcileFor] = useState<{ methodId: string; method: string } | null>(null);

  const agingRows = useMemo(
    () => (Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]).filter((k) => r.aging[k].count > 0),
    [r.aging]
  );

  if (!loading && user && !mayView) {
    router.replace("/");
    return null;
  }

  if (r.isLoading) {
    return (
      <ProtectedLayout>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={14} className="animate-spin" /> جارٍ تجميع الأرقام…
          </div>
          {[110, 260, 200].map((h, i) => (
            <div key={i} className="animate-pulse rounded-2xl" style={{ height: h, background: "var(--surface)" }} />
          ))}
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-5">

          <PageHeader
            title="التقارير المالية"
            subtitle={`${r.subscriberCount} مشترك · نسبة التحصيل ${Math.round(r.collectionRate * 100)}%`}
          />

          {r.isError && (
            <div
              className="flex items-start gap-2 rounded-xl p-3 text-xs"
              style={{ background: `${ACC.rose}10`, border: `1px solid ${ACC.rose}30`, color: "var(--text-secondary)" }}
            >
              <AlertTriangle size={14} style={{ color: ACC.rose }} className="shrink-0 mt-0.5" />
              تعذّر تحميل بعض البيانات — الأرقام أدناه قد تكون ناقصة.
            </div>
          )}

          {/* ── Headline ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="نقد محصَّل" accent={ACC.emerald} icon={<TrendingUp size={17} />}
              value={`$${formatNumber(r.collectedUSD, 0)}`}
              sub={`الصافي $${formatNumber(r.netUSD, 0)}`}
            />
            <Kpi
              label="المستحق" accent={ACC.amber} icon={<Wallet size={17} />}
              value={`$${formatNumber(r.outstandingFromSubscribersUSD, 0)}`}
              sub={`${r.subscribersWithBalance} مشترك عليه رصيد`}
            />
            <Kpi
              label="المُسترد" accent={r.refundedUSD > 0 ? ACC.rose : ACC.muted} icon={<RotateCcw size={17} />}
              value={r.refundedUSD > 0 ? `-$${formatNumber(r.refundedUSD, 0)}` : "—"}
            />
            <Kpi
              label="نسبة التحصيل"
              accent={r.collectionRate >= 0.9 ? ACC.emerald : r.collectionRate >= 0.7 ? ACC.amber : ACC.rose}
              icon={<Scale size={17} />}
              value={`${Math.round(r.collectionRate * 100)}%`}
              sub="نقد محصَّل ÷ (نقد محصَّل + مستحق)"
            />
          </div>

          {/*
            * Cash is not revenue, and this row is the difference.
            *
            * A $300 plan paid up front for 90 days is $300 of cash today and
            * about $3.33 of revenue a day. Reporting the whole $300 as this
            * month's earnings flatters a good month, hides a bad one, and makes
            * two months incomparable whenever plan lengths differ.
            *
            * Deferred revenue is the other half of the same truth: money taken
            * for service not yet delivered is a liability, not profit.
            */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi
              label="إيراد مستحق هذا الشهر" accent={ACC.indigo} icon={<Scale size={17} />}
              value={`$${formatNumber(r.recognizedRevenueUSD, 0)}`}
              sub="ما كُسب فعلاً بالتوزيع اليومي"
            />
            <Kpi
              label="إيراد مؤجَّل" accent={ACC.sky} icon={<Wallet size={17} />}
              value={`$${formatNumber(r.deferredRevenueUSD, 0)}`}
              sub="محصَّل مقابل خدمة لم تُقدَّم بعد"
            />
            <Kpi
              label="نقد هذا الشهر" accent={ACC.muted} icon={<TrendingUp size={17} />}
              value={`$${formatNumber(r.cashThisMonthUSD, 0)}`}
              sub={`الفرق عن المستحق $${formatNumber(r.cashThisMonthUSD - r.recognizedRevenueUSD, 0)}`}
            />
          </div>

          {r.unrecognizableCount > 0 && (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {r.unrecognizableCount} مشترك بلا تاريخ بداية أو مدة، فلا يمكن توزيع إيرادهم — مستثنون من الرقمين أعلاه، وليسوا صفراً.
            </p>
          )}

          <Tabs defaultValue="aging">
            <TabList className="flex-wrap">
              <Tab value="aging" badge={r.aging.d31_plus.count + r.aging.d8_30.count}>تقادم المستحقات</Tab>
              <Tab value="methods">حسب طريقة الدفع</Tab>
              <Tab value="receipts" badge={r.receiptsPendingReview}>الوصلات</Tab>
              <Tab value="renewals">التجديدات</Tab>
              <Tab value="invoices">الفواتير</Tab>
            </TabList>

            {/* ── AR aging ── */}
            <TabPanel value="aging">
              <div className="space-y-4 mt-5">
                <Panel title="تقادم المستحقات" icon={<Wallet size={15} style={{ color: ACC.rose }} />}>
                  {agingRows.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      لا توجد أقساط مستحقة — أو لا يوجد مشتركون بجدول أقساط بعد.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {agingRows.map((k) => (
                        <div key={k} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--divider)" }}>
                          <span className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: BUCKET_COLOR[k] }} />
                            {AGING_BUCKET_LABELS[k]}
                            <span className="opacity-60">({r.aging[k].count})</span>
                          </span>
                          <span className="text-sm font-black tabular-nums" style={{ color: BUCKET_COLOR[k] }}>
                            ${formatNumber(r.aging[k].amountUSD, 2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/*
                    The two outstanding figures measure different populations and
                    must not be added. Saying so is the whole point — a reader who
                    sums them would double-count every scheduled subscriber.
                  */}
                  <div className="mt-4 pt-3 border-t text-[11px] leading-relaxed" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    المستحق من الأقساط <b>${formatNumber(r.outstandingFromInstallmentsUSD, 2)}</b> يغطي المشتركين
                    الذين لهم جدول أقساط فقط. المستحق الإجمالي <b>${formatNumber(r.outstandingFromSubscribersUSD, 2)}</b> يشمل
                    الجميع بما فيهم المشتركون الأقدم بلا جدول — الرقمان قياسان مختلفان ولا يُجمعان.
                  </div>
                </Panel>

                {r.overdueInstallments.length > 0 && (
                  <Panel title={`أقساط متأخرة (${r.overdueInstallments.length})`} icon={<AlertTriangle size={15} style={{ color: ACC.rose }} />}>
                    <div className="overflow-x-auto -mx-5 -mb-5">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
                            {["المشترك", "القسط", "الاستحقاق", "المتبقي", "التقادم"].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {r.overdueInstallments.map((i) => (
                            <tr key={i.id} style={{ borderTop: "1px solid var(--divider)" }}>
                              <td className="px-4 py-2.5">
                                <Link href={`/subscribers/${i.subscriberId}`} className="hover:underline font-semibold" style={{ color: "var(--text-primary)" }}>
                                  {i.subscriberName || i.subscriberId}
                                </Link>
                              </td>
                              <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>#{i.installmentNumber}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(i.dueDate)}</td>
                              <td className="px-4 py-2.5 tabular-nums font-bold" style={{ color: ACC.rose }}>
                                ${formatNumber(Math.max(0, i.amountUSD - i.paidUSD), 2)}
                              </td>
                              <td className="px-4 py-2.5 text-[11px]" style={{ color: BUCKET_COLOR[agingBucketFor(i.dueDate, today)] }}>
                                {AGING_BUCKET_LABELS[agingBucketFor(i.dueDate, today)]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </div>
            </TabPanel>

            {/* ── By method + reconciliation ── */}
            <TabPanel value="methods">
              <div className="mt-5">
                <Panel title="المدفوعات حسب طريقة الدفع" icon={<CreditCard size={15} style={{ color: ACC.indigo }} />}>
                  {r.byMethod.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>لا توجد دفعات.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-5 -mb-5">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
                            {["الطريقة", "عدد الدفعات", "الإجمالي", "غير مطابَق", "قيمة غير المطابَق", ""].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {r.byMethod.map((m) => (
                            <tr key={m.methodId || m.method} style={{ borderTop: "1px solid var(--divider)" }}>
                              <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>{m.method}</td>
                              <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--text-secondary)" }}>{m.count}</td>
                              <td className="px-4 py-2.5 tabular-nums font-bold" style={{ color: ACC.emerald }}>
                                ${formatNumber(m.totalUSD, 2)}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums" style={{ color: m.unreconciledCount > 0 ? ACC.amber : "var(--text-muted)" }}>
                                {m.unreconciledCount}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums" style={{ color: m.unreconciledUSD > 0 ? ACC.amber : "var(--text-muted)" }}>
                                ${formatNumber(m.unreconciledUSD, 2)}
                              </td>
                              <td className="px-4 py-2.5">
                                {mayReconcile && m.methodId && m.unreconciledCount > 0 && (
                                  <button
                                    onClick={() => setReconcileFor({ methodId: m.methodId, method: m.method })}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                    style={{ background: `${ACC.indigo}12`, color: ACC.indigo, border: `1px solid ${ACC.indigo}30` }}
                                  >
                                    <Scale size={11} /> مطابقة
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </div>
            </TabPanel>

            {/* ── Receipts ── */}
            <TabPanel value="receipts">
              <div className="grid grid-cols-2 gap-3 mt-5 sm:grid-cols-3">
                <Kpi label="بانتظار المراجعة" value={String(r.receiptsPendingReview)} accent={ACC.amber} icon={<Receipt size={17} />} />
                <Kpi label="بلا وصل" value={String(r.receiptsMissing)} accent={ACC.muted} icon={<Receipt size={17} />} />
                <Kpi
                  label="تمت مراجعتها"
                  value={String(Math.max(0, r.byMethod.reduce((n, m) => n + m.count, 0) - r.receiptsPendingReview - r.receiptsMissing))}
                  accent={ACC.emerald} icon={<Receipt size={17} />}
                />
              </div>
            </TabPanel>

            {/* ── Renewals ── */}
            <TabPanel value="renewals">
              <div className="space-y-4 mt-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Kpi label="مستحق التجديد" value={String(r.renewalDue)} accent={ACC.amber} icon={<RefreshCw size={17} />} />
                  <Kpi label="تم التواصل" value={String(r.renewalContacted)} accent={ACC.indigo} icon={<RefreshCw size={17} />} />
                  <Kpi label="وعد بالدفع" value={String(r.renewalPromised)} accent={ACC.sky} icon={<RefreshCw size={17} />} />
                  <Kpi label="تم التجديد" value={String(r.renewalRenewed)} accent={ACC.emerald} icon={<RefreshCw size={17} />} />
                  <Kpi label="رفض التجديد" value={String(r.renewalDeclined)} accent={ACC.rose} icon={<RefreshCw size={17} />} />
                  <Kpi
                    label="نسبة التحويل"
                    value={`${Math.round(r.renewalConversion * 100)}%`}
                    sub="من وصل لقرار"
                    accent={r.renewalConversion >= 0.6 ? ACC.emerald : ACC.amber}
                    icon={<Scale size={17} />}
                  />
                </div>
              </div>
            </TabPanel>

            {/* ── Invoices ── */}
            <TabPanel value="invoices">
              <div className="mt-5">
                <Panel title="الفواتير حسب الحالة" icon={<FileText size={15} style={{ color: ACC.indigo }} />}>
                  {Object.keys(r.invoicesByStatus).length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      لا توجد فواتير بعد — تُنشأ تلقائياً مع كل مشترك جديد أو تجديد.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(r.invoicesByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--divider)" }}>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {INVOICE_STATUS_LABELS[status as InvoiceStatus] ?? status}
                          </span>
                          <span className="text-sm font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </div>

      {reconcileFor && (
        <ReconcileModal
          paymentMethodId={reconcileFor.methodId}
          paymentMethodName={reconcileFor.method}
          onClose={() => setReconcileFor(null)}
        />
      )}
    </ProtectedLayout>
  );
}
