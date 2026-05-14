"use client";

import { motion } from "framer-motion";
import {
  DollarSign, RefreshCw, Clock, CreditCard, Calendar,
  Globe, Phone, AlertCircle, CheckCircle2, XCircle,
  PauseCircle, Snowflake, TrendingUp, User, Star,
} from "lucide-react";
import { formatDate, formatNumber, getWhatsAppLink, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import type { Subscriber } from "@/types";
import type { PaymentTransaction } from "@/types";
import type { RefundTransaction } from "@/types";

const ACC = { indigo:"#6366f1", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8" };
const fadeUp = { hidden:{opacity:0,y:12}, show:{opacity:1,y:0} };
const tran   = { duration:0.32, ease:"easeOut" } as const;
const stagger = { show:{transition:{staggerChildren:0.05}} };

function fmtDate(raw: unknown): string {
  if (!raw) return "—";
  if (typeof raw === "string") return formatDate(raw);
  if (raw instanceof Date) return formatDate(raw.toISOString().slice(0,10));
  if (typeof (raw as {toDate?():Date}).toDate === "function")
    return formatDate((raw as {toDate():Date}).toDate().toISOString().slice(0,10));
  return String(raw);
}

function residenceLabel(v: string) {
  return RESIDENCE_COUNTRIES.find((c) => c.value === v)?.name
    || PHONE_COUNTRIES.find((c) => c.iso === v)?.name
    || v || "—";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "نشط")         return <CheckCircle2 size={13} className="text-emerald-500" />;
  if (status === "ينتهي قريباً") return <AlertCircle  size={13} className="text-amber-500" />;
  if (status === "منتهي")       return <XCircle       size={13} className="text-rose-500" />;
  if (status === "موقوف")       return <PauseCircle   size={13} className="text-orange-500" />;
  if (status === "متجمد")       return <Snowflake     size={13} className="text-sky-500" />;
  return <XCircle size={13} className="text-slate-400" />;
}

function statusColor(status: string) {
  if (status === "نشط")          return ACC.emerald;
  if (status === "ينتهي قريباً") return ACC.amber;
  if (status === "منتهي")        return ACC.rose;
  if (status === "موقوف")        return "#f97316";
  if (status === "متجمد")        return ACC.sky;
  return "#64748b";
}

interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

function KpiCard({ icon, label, value, sub, accent }: KpiProps) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl"
        style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
        <span style={{ color:accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider truncate"
          style={{ color:"var(--text-muted)" }}>{label}</p>
        <p className="text-lg font-black tabular-nums leading-tight" style={{ color:"var(--text-primary)" }}>
          {value}
        </p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color:"var(--text-secondary)" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor:"var(--divider)" }}>
      <span className="text-xs" style={{ color:"var(--text-secondary)" }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      className="rounded-2xl overflow-hidden"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor:"var(--divider)" }}>
        <h3 className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

interface Props {
  subscriber: Subscriber;
  payments: PaymentTransaction[];
  refunds: RefundTransaction[];
  canRev: boolean;
}

export default function OverviewTab({ subscriber: s, payments, refunds, canRev }: Props) {
  const sc = statusColor(s.status);
  const daysRem = s.daysRemaining;
  const totalPaid = payments.reduce((sum, p) => sum + (p.amountUSD || 0), 0);
  const totalRefunded = refunds.reduce((sum, r) => sum + (r.refundAmountUSD || 0), 0);
  const lastPayment = payments[0];
  const expiringsSoon = daysRem > 0 && daysRem <= 7;

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          accent={ACC.emerald} icon={<DollarSign size={17}/>}
          label="إجمالي المدفوع"
          value={canRev ? `$${formatNumber(totalPaid, 0)}` : "—"}
        />
        <KpiCard
          accent={ACC.indigo} icon={<RefreshCw size={17}/>}
          label="عدد التجديدات"
          value={String(s.renewalCount || 0)}
          sub={s.lastRenewalDate ? `آخر تجديد: ${fmtDate(s.lastRenewalDate)}` : undefined}
        />
        <KpiCard
          accent={expiringsSoon ? ACC.rose : daysRem > 15 ? ACC.emerald : ACC.amber}
          icon={<Clock size={17}/>}
          label="الأيام المتبقية"
          value={daysRem > 0 ? `${daysRem} يوم` : "منتهي"}
          sub={`ينتهي ${formatDate(s.expiryDate)}`}
        />
        <KpiCard
          accent={ACC.amber} icon={<CreditCard size={17}/>}
          label="طريقة الدفع"
          value={s.payment || lastPayment?.paymentMethod || "—"}
        />
      </div>

      {/* ── Financial health bar ── */}
      {canRev && s.totalPriceUSD > 0 && (
        <motion.div variants={fadeUp} transition={tran}
          className="rounded-2xl p-4"
          style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold" style={{ color:"var(--text-primary)" }}>تقدم الدفع</span>
            <span className="text-xs font-semibold" style={{ color:"var(--text-muted)" }}>
              ${formatNumber(s.paidAmountUSD, 0)} / ${formatNumber(s.totalPriceUSD, 0)}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background:"var(--surface-2)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (s.paidAmountUSD / s.totalPriceUSD) * 100)}%`,
                background: s.remainingAmountUSD > 0.01
                  ? `linear-gradient(90deg, ${ACC.emerald}, ${ACC.amber})`
                  : `linear-gradient(90deg, ${ACC.emerald}, ${ACC.emerald})`,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px]">
            {s.remainingAmountUSD > 0.01 ? (
              <span style={{ color:ACC.amber }}>
                متبقي: ${formatNumber(s.remainingAmountUSD, 2)}
              </span>
            ) : (
              <span className="flex items-center gap-1" style={{ color:ACC.emerald }}>
                <CheckCircle2 size={11}/> مكتمل
              </span>
            )}
            {totalRefunded > 0 && (
              <span style={{ color:ACC.rose }}>مُسترد: ${formatNumber(totalRefunded, 2)}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Subscription + Personal ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SectionCard title="تفاصيل الاشتراك">
          <InfoRow label="تاريخ الاشتراك" value={formatDate(s.date)} />
          <InfoRow label="تاريخ الانتهاء" value={
            <span style={{ color: expiringsSoon ? ACC.rose : undefined }}>
              {formatDate(s.expiryDate)}
              {expiringsSoon && <span className="mr-1.5 text-[10px] font-bold" style={{ color:ACC.rose }}>⚡ قريباً</span>}
            </span>
          }/>
          <InfoRow label="المدة (أيام)" value={String(s.duration)} />
          <InfoRow label="الباقة" value={
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.package==="ذهبية"?"pkg-gold":"pkg-silver"}`}>
              {s.package}
            </span>
          }/>
          <InfoRow label="الفريق" value={s.team || "غير محدد"} />
          <InfoRow label="أقنعه" value={s.convincedBy || "—"} />
          <InfoRow label="قبض الفلوس" value={s.paidShift || "—"} />
          <InfoRow label="المصدر" value={s.source || "—"} />
          {s.source === "ترشيح" && s.referrer && (
            <InfoRow label="المرشِّح" value={s.referrer} />
          )}
          {canRev && (
            <>
              <InfoRow label="المبلغ الكلي" value={`$${formatNumber(s.totalPriceUSD, 2)}`} />
              <InfoRow label="المدفوع" value={
                <span style={{ color:ACC.emerald }}>${formatNumber(s.paidAmountUSD, 2)}</span>
              }/>
              {s.remainingAmountUSD > 0.01 && (
                <InfoRow label="المتبقي" value={
                  <span style={{ color:ACC.amber }}>${formatNumber(s.remainingAmountUSD, 2)}</span>
                }/>
              )}
              {totalRefunded > 0 && (
                <InfoRow label="المُسترد" value={
                  <span style={{ color:ACC.rose }}>-${formatNumber(totalRefunded, 2)}</span>
                }/>
              )}
              <InfoRow label="الصافي" value={
                <span className="font-black" style={{ color:ACC.emerald }}>
                  ${formatNumber(s.netAmountUSD, 2)}
                </span>
              }/>
              <InfoRow label="العملة الأصلية"
                value={`${s.currencyOriginal} (${formatNumber(s.totalPrice, 2)})`} />
            </>
          )}
        </SectionCard>

        <SectionCard title="المعلومات الشخصية">
          <InfoRow label="الاسم الكامل" value={s.name} />
          {s.age && <InfoRow label="العمر" value={`${s.age} سنة`} />}
          <InfoRow label="الإقامة" value={residenceLabel(s.residence)} />
          {s.dialCode && s.phone && (
            <InfoRow label="الهاتف" value={
              <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-emerald-500"
                dir="ltr">
                <Phone size={11}/>{s.dialCode} {s.phone}
              </a>
            }/>
          )}
          <InfoRow label="الحالة" value={
            <span className="flex items-center gap-1" style={{ color:sc }}>
              <StatusIcon status={s.status}/>{s.status}
            </span>
          }/>
          {s.renewalCount > 0 && (
            <InfoRow label="عدد التجديدات" value={`${s.renewalCount} مرة`} />
          )}
          {s.lifetimeValueUSD > 0 && canRev && (
            <InfoRow label="القيمة الإجمالية (LTV)" value={
              <span className="font-black" style={{ color:ACC.indigo }}>
                ${formatNumber(s.lifetimeValueUSD, 0)}
              </span>
            }/>
          )}
          {s.createdAt && (
            <InfoRow label="تاريخ الإضافة" value={fmtDate(s.createdAt)} />
          )}
          {s.notes && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor:"var(--divider)" }}>
              <p className="text-[10px] font-medium mb-1" style={{ color:"var(--text-muted)" }}>ملاحظات</p>
              <p className="text-xs leading-relaxed" style={{ color:"var(--text-secondary)" }}>{s.notes}</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Freeze/Pause status ── */}
      {(s.subscriptionStatus === "paused" || s.subscriptionStatus === "frozen") && (
        <motion.div variants={fadeUp} transition={tran}
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background:`${ACC.amber}10`, border:`1px solid ${ACC.amber}30` }}>
          <PauseCircle size={18} style={{ color:ACC.amber, marginTop:1 }}/>
          <div>
            <p className="text-sm font-bold" style={{ color:ACC.amber }}>
              الاشتراك {s.subscriptionStatus === "paused" ? "موقوف" : "متجمد"}
            </p>
            {s.pauseReason && (
              <p className="text-xs mt-0.5" style={{ color:"var(--text-secondary)" }}>{s.pauseReason}</p>
            )}
            {s.remainingDaysAtPause != null && (
              <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>
                أيام متبقية عند الإيقاف: {s.remainingDaysAtPause}
              </p>
            )}
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}
