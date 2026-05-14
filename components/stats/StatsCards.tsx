"use client";

import { useMemo } from "react";
import type { Subscriber }        from "@/types";
import type { Payment }           from "@/types";
import type { RefundTransaction } from "@/types";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Users, TrendingUp, Clock, Star, Award, PauseCircle, Snowflake, UserMinus, DollarSign, TrendingDown } from "lucide-react";
import { calculateChurnRate } from "@/lib/analytics/calculations";

interface Props {
  subscribers:  Subscriber[];
  payments?:    Payment[];
  refunds?:     RefundTransaction[];
  periodLabel?: string;
}

interface CardConfig {
  accentBorder: string;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  tagCls: string;
}

const CARD_STYLES = {
  total:     { accentBorder: "border-t-blue-500",    iconBg: "bg-blue-50",    iconColor: "text-blue-600",    cardBg: "",              tagCls: "bg-blue-50 text-blue-600" },
  active:    { accentBorder: "border-t-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", cardBg: "bg-emerald-50/20", tagCls: "bg-emerald-50 text-emerald-700" },
  expiring:  { accentBorder: "border-t-amber-500",   iconBg: "bg-amber-50",   iconColor: "text-amber-600",   cardBg: "bg-amber-50/20",   tagCls: "bg-amber-50 text-amber-700" },
  paused:    { accentBorder: "border-t-orange-500",  iconBg: "bg-orange-50",  iconColor: "text-orange-600",  cardBg: "bg-orange-50/20",  tagCls: "bg-orange-50 text-orange-700" },
  frozen:    { accentBorder: "border-t-sky-500",     iconBg: "bg-sky-50",     iconColor: "text-sky-600",     cardBg: "bg-sky-50/20",     tagCls: "bg-sky-50 text-sky-700" },
  withdrawn: { accentBorder: "border-t-rose-500",    iconBg: "bg-rose-50",    iconColor: "text-rose-600",    cardBg: "bg-rose-50/20",    tagCls: "bg-rose-50 text-rose-700" },
  silver:    { accentBorder: "border-t-slate-400",   iconBg: "bg-slate-100",  iconColor: "text-slate-500",   cardBg: "",                 tagCls: "" },
  gold:      { accentBorder: "border-t-amber-400",   iconBg: "bg-amber-50",   iconColor: "text-amber-500",   cardBg: "",                 tagCls: "" },
  mrr:       { accentBorder: "border-t-violet-500",  iconBg: "bg-violet-50",  iconColor: "text-violet-600",  cardBg: "bg-violet-50/20",  tagCls: "bg-violet-50 text-violet-700" },
  churn:     { accentBorder: "border-t-rose-400",    iconBg: "bg-rose-50",    iconColor: "text-rose-500",    cardBg: "bg-rose-50/10",    tagCls: "bg-rose-50 text-rose-600" },
} satisfies Record<string, CardConfig>;

function StatCard({
  style,
  icon,
  tag,
  tagContent,
  value,
  label,
  sub,
}: {
  style: CardConfig;
  icon: React.ReactNode;
  tag?: React.ReactNode;
  tagContent?: string;
  value: string;
  label: string;
  sub?: React.ReactNode;
}) {
  return (
    <div
      className={`
        group relative rounded-2xl p-5 border border-t-[3px] overflow-hidden
        transition-all duration-200 cursor-default
        hover:-translate-y-0.5
        ${style.accentBorder}
        ${style.cardBg}
        bg-white
        shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.06)]
        hover:shadow-[0_4px_16px_rgba(0,0,0,0.10),_0_1px_3px_rgba(0,0,0,0.06)]
        border-l-[rgba(0,0,0,0.07)] border-r-[rgba(0,0,0,0.07)] border-b-[rgba(0,0,0,0.07)]
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconBg} transition-transform duration-200 group-hover:scale-110`}>
          <span className={style.iconColor}>{icon}</span>
        </div>
        {tag || (tagContent && (
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${style.tagCls}`}>
            {tagContent}
          </span>
        ))}
      </div>

      <p className="text-3xl font-black text-slate-900 leading-none tabular-nums tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-slate-400 mt-1.5 tracking-wide uppercase" style={{ fontSize: "0.68rem" }}>{label}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

export default function StatsCards({ subscribers, payments = [], refunds = [], periodLabel }: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");
  const periodTag = periodLabel ?? "هذا الشهر";

  const stats = useMemo(() => {
    const total = subscribers.length;
    const paused = subscribers.filter((s) => s.subscriptionStatus === "paused").length;
    const frozen = subscribers.filter((s) => s.freezeData?.isFrozen === true).length;
    const active = subscribers.filter(
      (s) =>
        s.subscriptionState !== "withdrawn" &&
        s.subscriptionStatus !== "paused" &&
        s.freezeData?.isFrozen !== true &&
        s.status === "نشط"
    ).length;
    const expiring = subscribers.filter(
      (s) =>
        s.subscriptionState !== "withdrawn" &&
        s.subscriptionStatus !== "paused" &&
        s.freezeData?.isFrozen !== true &&
        s.status === "ينتهي قريباً"
    ).length;
    const withdrawn = subscribers.filter((s) => s.subscriptionState === "withdrawn").length;
    const silver = subscribers.filter((s) => s.package === "فضية").length;
    const gold = subscribers.filter((s) => s.package === "ذهبية").length;
    const netUSD = subscribers
      .filter((s) => s.freezeData?.isFrozen !== true && s.subscriptionState !== "withdrawn")
      .reduce((sum, s) => sum + s.netAmountUSD, 0);
    const remaining = subscribers
      .filter((s) => s.subscriptionState !== "withdrawn")
      .reduce((sum, s) => sum + s.remainingAmountUSD, 0);
    const revenue   = payments.reduce((s, p) => s + (p.amountUSD ?? 0), 0);
    const refunded  = refunds.reduce((s, r) => s + (r.refundAmountUSD ?? 0), 0);
    const mrr       = Math.max(0, revenue - refunded);
    const churnRate = calculateChurnRate(subscribers);
    return { total, active, expiring, paused, frozen, withdrawn, silver, gold, netUSD, remaining, mrr, churnRate };
  }, [subscribers, payments, refunds]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
      <StatCard
        style={CARD_STYLES.total}
        icon={<Users size={18} />}
        tagContent="الكل"
        value={formatNumber(stats.total)}
        label="إجمالي المشتركين"
        sub={canRev && (
          <p className="text-xs text-emerald-600 font-bold">${formatNumber(stats.netUSD, 2)}</p>
        )}
      />

      <StatCard
        style={CARD_STYLES.active}
        icon={<TrendingUp size={18} />}
        tagContent="نشط"
        value={formatNumber(stats.active)}
        label="اشتراك نشط"
      />

      <StatCard
        style={CARD_STYLES.expiring}
        icon={<Clock size={18} />}
        tagContent="قريباً"
        value={formatNumber(stats.expiring)}
        label="ينتهي قريباً"
        sub={canRev && stats.remaining > 0 && (
          <p className="text-xs text-amber-600 font-bold">متبقي ${formatNumber(stats.remaining, 2)}</p>
        )}
      />

      {stats.paused > 0 && (
        <StatCard
          style={CARD_STYLES.paused}
          icon={<PauseCircle size={18} />}
          tagContent="موقوف"
          value={formatNumber(stats.paused)}
          label="اشتراك موقوف"
        />
      )}

      {stats.frozen > 0 && (
        <StatCard
          style={CARD_STYLES.frozen}
          icon={<Snowflake size={18} />}
          tagContent="متجمد"
          value={formatNumber(stats.frozen)}
          label="اشتراك متجمد"
        />
      )}

      {stats.withdrawn > 0 && (
        <StatCard
          style={CARD_STYLES.withdrawn}
          icon={<UserMinus size={18} />}
          tagContent="منسحب"
          value={formatNumber(stats.withdrawn)}
          label="اشتراك منسحب"
        />
      )}

      <StatCard
        style={CARD_STYLES.silver}
        icon={<Star size={18} />}
        tag={<span className="pkg-silver text-xs px-2.5 py-1 rounded-lg">فضية</span>}
        value={formatNumber(stats.silver)}
        label="باقة فضية"
      />

      <StatCard
        style={CARD_STYLES.gold}
        icon={<Award size={18} />}
        tag={<span className="pkg-gold text-xs px-2.5 py-1 rounded-lg">ذهبية</span>}
        value={formatNumber(stats.gold)}
        label="باقة ذهبية"
      />

      {canRev && (
        <StatCard
          style={CARD_STYLES.mrr}
          icon={<DollarSign size={18} />}
          tagContent={periodTag}
          value={`$${formatNumber(stats.mrr, 0)}`}
          label="الإيراد — صافي الفترة"
          sub={
            <p className="text-xs text-violet-600 font-semibold">صافي بعد الاسترداد</p>
          }
        />
      )}

      {canRev && (
        <StatCard
          style={CARD_STYLES.churn}
          icon={<TrendingDown size={18} />}
          tagContent={periodTag}
          value={`${(stats.churnRate * 100).toFixed(1)}%`}
          label="Churn Rate — نسبة الانسحاب"
          sub={
            stats.churnRate === 0
              ? <p className="text-xs text-emerald-600 font-semibold">لا انسحاب هذا الشهر</p>
              : <p className="text-xs text-rose-500 font-semibold">
                  {Math.round(stats.churnRate * 100 * subscribers.length / 100)} منسحب
                </p>
          }
        />
      )}
    </div>
  );
}
