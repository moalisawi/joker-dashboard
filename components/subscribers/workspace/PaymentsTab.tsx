"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore }  from "@/store/authStore";
import { usePayments }   from "@/hooks/usePayments";
import { useRefunds }    from "@/hooks/useRefunds";
import {
  canCreatePayments, canRefundPayments,
  canFreezeSubscriptions,
} from "@/lib/permissionGuards";
import { formatNumber } from "@/lib/utils";
import type { Subscriber } from "@/types";
import type { PaymentTransaction } from "@/types";
import type { RefundTransaction } from "@/types";
import {
  DollarSign, TrendingDown, AlertCircle, CheckCircle2,
  RotateCcw, Plus, CreditCard, Calendar, Receipt,
} from "lucide-react";

const ACC = { indigo:"#83A2DB", emerald:"#83A2DB", amber:"#E8B570", rose:"#CE6969", sky:"#9DB4D6" };
const fadeUp = { hidden:{opacity:0,y:10}, show:{opacity:1,y:0} };
const tran   = { duration:0.28, ease:"easeOut" } as const;
const stagger = { show:{transition:{staggerChildren:0.05}} };

function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as {toDate?:()=>Date}).toDate === "function")
    return (raw as {toDate:()=>Date}).toDate().toISOString().slice(0,10);
  if (raw instanceof Date) return raw.toISOString().slice(0,10);
  return "—";
}

function PaymentTypeBadge({ p }: { p: PaymentTransaction }) {
  if (p.isInitialPayment) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
      style={{ background:`${ACC.indigo}15`, color:ACC.indigo }}>أولية</span>
  );
  if (p.isRenewalPayment) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
      style={{ background:`${ACC.emerald}15`, color:ACC.emerald }}>تجديد</span>
  );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
      style={{ background:`${ACC.amber}15`, color:ACC.amber }}>دفعة</span>
  );
}

interface FinKpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  sub?: string;
}

function FinKpi({ icon, label, value, accent, sub }: FinKpiProps) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl"
        style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
        <span style={{ color:accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide truncate"
          style={{ color:"var(--text-muted)" }}>{label}</p>
        <p className="text-lg font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-[10px]" style={{ color:"var(--text-muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

interface Props {
  subscriber: Subscriber;
  onAddPayment: () => void;
}

export default function PaymentsTab({ subscriber: s, onAddPayment }: Props) {
  const { user }            = useAuthStore();
  const { payments, loading: pLoad } = usePayments({ subscriberId: s.id });
  const { refunds,  loading: rLoad } = useRefunds ({ subscriberId: s.id });

  const canPay    = canCreatePayments(user)    || user?.role === "owner" || user?.role === "admin";
  const canRefund = canRefundPayments(user)    || user?.role === "owner";
  const canRev    = user?.role === "owner" || user?.role === "admin" ||
    (user?.granularPermissions?.analytics?.view ?? false);

  const [showRefunds, setShowRefunds] = useState(false);
  const [payFilter, setPayFilter]     = useState<"all"|"initial"|"renewal"|"installment">("all");

  const totalPaid     = payments.reduce((n, p) => n + (p.amountUSD ?? 0), 0);
  const totalRefunded = refunds.reduce((n, r) => n + (r.refundAmountUSD ?? 0), 0);
  const remaining     = s.remainingAmountUSD;

  const filteredPayments = payments.filter((p) => {
    if (payFilter === "initial")     return p.isInitialPayment;
    if (payFilter === "renewal")     return p.isRenewalPayment;
    if (payFilter === "installment") return !p.isInitialPayment && !p.isRenewalPayment;
    return true;
  });

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

      {/* ── Financial KPIs ── */}
      {canRev && (
        <motion.div variants={fadeUp} transition={tran} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FinKpi
            accent={ACC.emerald} icon={<DollarSign size={17}/>}
            label="إجمالي المدفوع"
            value={`$${formatNumber(totalPaid, 0)}`}
            sub={`${payments.length} دفعة`}
          />
          <FinKpi
            accent={remaining > 0 ? ACC.amber : ACC.emerald}
            icon={remaining > 0 ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}
            label="المتبقي"
            value={remaining > 0 ? `$${formatNumber(remaining, 2)}` : "مكتمل"}
          />
          <FinKpi
            accent={totalRefunded > 0 ? ACC.rose : "#94a3b8"}
            icon={<TrendingDown size={17}/>}
            label="المُسترد"
            value={totalRefunded > 0 ? `-$${formatNumber(totalRefunded, 2)}` : "—"}
          />
          <FinKpi
            accent={ACC.indigo} icon={<CreditCard size={17}/>}
            label="الصافي"
            value={`$${formatNumber(s.netAmountUSD, 0)}`}
          />
        </motion.div>
      )}

      {/* ── Progress bar ── */}
      {canRev && s.totalPriceUSD > 0 && (
        <motion.div variants={fadeUp}
          className="rounded-2xl p-4"
          style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color:"var(--text-primary)" }}>تقدم الدفع</span>
            <span className="text-xs font-semibold" style={{ color:"var(--text-muted)" }}>
              {Math.round((s.paidAmountUSD / s.totalPriceUSD) * 100)}% مكتمل
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background:"var(--surface-2)" }}>
            <div className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (s.paidAmountUSD / s.totalPriceUSD) * 100)}%`,
                background: remaining > 0
                  ? `linear-gradient(90deg, ${ACC.emerald}, ${ACC.amber})`
                  : `linear-gradient(90deg, ${ACC.emerald}, #83A2DB)`,
              }}/>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px]">
            <span style={{ color:ACC.emerald }}>مدفوع: ${formatNumber(s.paidAmountUSD, 2)}</span>
            <span style={{ color:"var(--text-muted)" }}>إجمالي: ${formatNumber(s.totalPriceUSD, 2)}</span>
          </div>
        </motion.div>
      )}

      {/* ── Payments list ── */}
      <motion.div variants={fadeUp}
        className="rounded-2xl overflow-hidden"
        style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Receipt size={15} style={{ color:ACC.emerald }}/>
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
              سجل الدفعات
            </span>
            {!pLoad && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:`${ACC.emerald}18`, color:ACC.emerald }}>
                {payments.length}
              </span>
            )}
          </div>
          {canPay && (
            <button onClick={onAddPayment}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white"
              style={{ background:`linear-gradient(135deg,${ACC.emerald},#83A2DB)` }}>
              <Plus size={12}/>دفعة جديدة
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="px-5 py-3 flex gap-2 flex-wrap border-b" style={{ borderColor:"var(--border)" }}>
          {[
            { k:"all", l:"الكل" },
            { k:"initial", l:"أولية" },
            { k:"renewal", l:"تجديد" },
            { k:"installment", l:"دفعة" },
          ].map(({ k, l }) => (
            <button key={k}
              onClick={() => setPayFilter(k as typeof payFilter)}
              className="px-3 py-1 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: payFilter === k ? `${ACC.indigo}18` : "var(--surface-2)",
                color:      payFilter === k ? ACC.indigo : "var(--text-muted)",
                border:     `1px solid ${payFilter === k ? ACC.indigo + "40" : "var(--border)"}`,
              }}>
              {l}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {pLoad ? (
            <div className="space-y-2 p-5 animate-pulse">
              {[1,2,3].map((i) => <div key={i} className="h-10 rounded-xl" style={{ background:"var(--surface-2)" }}/>)}
            </div>
          ) : filteredPayments.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color:"var(--text-muted)" }}>لا توجد دفعات</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom:`1px solid var(--divider)` }}>
                  {["التاريخ","المبلغ","العملة","طريقة الدفع","النوع","وصل"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-right font-semibold"
                      style={{ color:"var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-[#83A2DB08]"
                    style={{ borderBottom:`1px solid var(--divider)` }}>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color:"var(--text-primary)" }}>
                      <span className="flex items-center gap-1.5"><Calendar size={10}/>{toDateStr(p.date)}</span>
                    </td>
                    <td className="px-5 py-3 font-bold tabular-nums whitespace-nowrap"
                      style={{ color:ACC.emerald }}>
                      {canRev ? `$${formatNumber(p.amountUSD, 2)}` : "—"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color:"var(--text-secondary)" }}>
                      {p.currencyOriginal}
                      {canRev && p.amountOriginal !== p.amountUSD
                        ? ` (${formatNumber(p.amountOriginal, 2)})` : ""}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color:"var(--text-secondary)" }}>
                      {p.paymentMethod || "—"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <PaymentTypeBadge p={p}/>
                    </td>
                    <td className="px-5 py-3">
                      {p.receiptUrl
                        ? <a href={p.receiptUrl} target="_blank" rel="noreferrer"
                            className="text-xs font-medium hover:underline"
                            style={{ color:ACC.sky }}>عرض</a>
                        : <span style={{ color:"var(--text-muted)" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* ── Refunds ── */}
      <motion.div variants={fadeUp}
        className="rounded-2xl overflow-hidden"
        style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <RotateCcw size={14} style={{ color:ACC.rose }}/>
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>الاستردادات</span>
            {!rLoad && refunds.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:`${ACC.rose}18`, color:ACC.rose }}>
                {refunds.length}
              </span>
            )}
          </div>
          {refunds.length > 0 && (
            <button onClick={() => setShowRefunds((v) => !v)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)" }}>
              {showRefunds ? "إخفاء" : "عرض"}
            </button>
          )}
        </div>

        {rLoad ? (
          <div className="p-5 animate-pulse space-y-2">
            {[1,2].map((i) => <div key={i} className="h-10 rounded-xl" style={{ background:"var(--surface-2)" }}/>)}
          </div>
        ) : refunds.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color:"var(--text-muted)" }}>لا توجد استردادات</p>
        ) : showRefunds ? (
          <div className="px-5 py-3">
            {refunds.map((r) => (
              <div key={r.id}
                className="flex items-center justify-between py-2.5 border-b last:border-0"
                style={{ borderColor:"var(--divider)" }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>
                    {toDateStr(r.refundDate)}
                  </p>
                  <p className="text-[11px]" style={{ color:"var(--text-secondary)" }}>
                    {r.refundReason || "—"}
                  </p>
                </div>
                {canRev && (
                  <span className="text-xs font-bold" style={{ color:ACC.rose }}>
                    -${formatNumber(r.refundAmountUSD, 2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-3 flex items-center gap-2 text-xs" style={{ color:"var(--text-secondary)" }}>
            <AlertCircle size={13} style={{ color:ACC.rose }}/>
            {refunds.length} استرداد {canRev ? `· إجمالي -$${formatNumber(totalRefunded, 2)}` : ""}
          </div>
        )}
      </motion.div>

      {/* ── Remaining balance warning ── */}
      {remaining > 0.01 && (
        <motion.div variants={fadeUp}
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background:`${ACC.amber}10`, border:`1px solid ${ACC.amber}30` }}>
          <AlertCircle size={16} style={{ color:ACC.amber, marginTop:1 }}/>
          <div>
            <p className="text-sm font-bold" style={{ color:ACC.amber }}>
              {canRev ? `رصيد متبقي: $${formatNumber(remaining, 2)}` : "يوجد رصيد متبقي"}
            </p>
            <p className="text-xs mt-0.5" style={{ color:"var(--text-secondary)" }}>
              الاشتراك لم يُسدَّد بالكامل بعد.
            </p>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}
