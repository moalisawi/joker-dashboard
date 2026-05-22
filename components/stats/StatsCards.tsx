"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Subscriber }        from "@/types";
import type { Payment }           from "@/types";
import type { RefundTransaction } from "@/types";
import { formatNumber } from "@/lib/utils";
import { fadeUpVariants, staggerContainer, useCountUp } from "@/lib/animations";
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
  iconColor:   string;
  tagColor:    string;
  cardBg?:     string;
  cardBorder?: string;
  labelColor?: string;
}

const CARD_STYLES = {
  total:     { iconColor: "#5B5FEF",  tagColor: "#6B7280" },
  active:    { iconColor: "#5B5FEF",  tagColor: "#5B5FEF" },
  expiring:  { iconColor: "#F59E0B",  tagColor: "#F59E0B" },
  paused:    { iconColor: "#F59E0B",  tagColor: "#F59E0B" },
  frozen:    { iconColor: "#3B82F6",  tagColor: "#3B82F6" },
  withdrawn: { iconColor: "#9CA3AF",  tagColor: "#9CA3AF" },
  silver: {
    iconColor:   "#5A6680",
    tagColor:    "#475569",
    cardBg:      "linear-gradient(145deg, #E2E6EF 0%, #F8F9FC 52%, #D4D9E5 100%)",
    cardBorder:  "1px solid rgba(255,255,255,.85)",
    labelColor:  "#475569",
  },
  gold: {
    iconColor:   "#B07D10",
    tagColor:    "#92640A",
    cardBg:      "linear-gradient(145deg, #F5E4A6 0%, #FEF7E6 52%, #EDD078 100%)",
    cardBorder:  "1px solid rgba(210,155,30,.28)",
    labelColor:  "#92640A",
  },
  mrr:       { iconColor: "#5B5FEF",  tagColor: "#5B5FEF" },
  churn:     { iconColor: "#EF4444",  tagColor: "#EF4444" },
} satisfies Record<string, CardConfig>;

function StatCard({
  style,
  icon,
  tag,
  tagContent,
  value,
  label,
  sub,
  rawValue,
  valuePrefix = "",
  valueSuffix = "",
  valueDecimals = 0,
}: {
  style: CardConfig;
  icon: React.ReactNode;
  tag?: React.ReactNode;
  tagContent?: string;
  value: string;
  label: string;
  sub?: React.ReactNode;
  rawValue?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  valueDecimals?: number;
}) {
  const animated    = useCountUp(rawValue ?? 0);
  const displayValue = rawValue !== undefined
    ? `${valuePrefix}${formatNumber(animated, valueDecimals)}${valueSuffix}`
    : value;

  return (
    <motion.div
      variants={fadeUpVariants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="group relative cursor-default"
      style={{
        background: style.cardBg ?? "var(--jk-surface)",
        border: style.cardBorder ?? "1px solid var(--jk-border)",
        borderRadius: 22,
        padding: 22,
        boxShadow: "var(--jk-shadow-stat)",
        transition: "box-shadow .25s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 2px 4px rgba(16,20,26,.04), 0 14px 32px -8px ${style.iconColor}38`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--jk-shadow-stat)";
      }}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 14 }}>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: `${style.iconColor}1A`,
            color: style.iconColor,
            border: `1px solid ${style.iconColor}33`,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        {tag || (tagContent && (
          <span
            style={{
              background: `${style.tagColor}24`,
              color: style.tagColor,
              borderRadius: 999,
              border: `1px solid ${style.tagColor}48`,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {tagContent}
          </span>
        ))}
      </div>

      <p style={{ color: style.labelColor ? "#5B5FEF" : "var(--jk-text)", fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", margin: 0 }}>{displayValue}</p>
      <p style={{ color: style.labelColor ?? "var(--jk-muted)", fontSize: 13, fontWeight: 500, marginTop: 6 }}>{label}</p>
      {sub && <div style={{ marginTop: 8, fontSize: 12, color: "var(--jk-subtle)" }}>{sub}</div>}
    </motion.div>
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
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <StatCard
        style={CARD_STYLES.total}
        icon={<Users size={18} />}
        tagContent="الكل"
        value={formatNumber(stats.total)}
        rawValue={stats.total}
        label="إجمالي المشتركين"
        sub={canRev && (
          <p style={{ color: "#5B5FEF", fontSize: 12, fontWeight: 700 }}>${formatNumber(stats.netUSD, 2)}</p>
        )}
      />

      <StatCard
        style={CARD_STYLES.active}
        icon={<TrendingUp size={18} />}
        tagContent="نشط"
        value={formatNumber(stats.active)}
        rawValue={stats.active}
        label="اشتراك نشط"
      />

      <StatCard
        style={CARD_STYLES.expiring}
        icon={<Clock size={18} />}
        tagContent="قريباً"
        value={formatNumber(stats.expiring)}
        rawValue={stats.expiring}
        label="ينتهي قريباً"
        sub={canRev && stats.remaining > 0 && (
          <p style={{ color: "#F59E0B", fontSize: 12, fontWeight: 700 }}>متبقي ${formatNumber(stats.remaining, 2)}</p>
        )}
      />

      {stats.paused > 0 && (
        <StatCard
          style={CARD_STYLES.paused}
          icon={<PauseCircle size={18} />}
          tagContent="موقوف"
          value={formatNumber(stats.paused)}
          rawValue={stats.paused}
          label="اشتراك موقوف"
        />
      )}

      {stats.frozen > 0 && (
        <StatCard
          style={CARD_STYLES.frozen}
          icon={<Snowflake size={18} />}
          tagContent="متجمد"
          value={formatNumber(stats.frozen)}
          rawValue={stats.frozen}
          label="اشتراك متجمد"
        />
      )}

      {stats.withdrawn > 0 && (
        <StatCard
          style={CARD_STYLES.withdrawn}
          icon={<UserMinus size={18} />}
          tagContent="منسحب"
          value={formatNumber(stats.withdrawn)}
          rawValue={stats.withdrawn}
          label="اشتراك منسحب"
        />
      )}

      <StatCard
        style={CARD_STYLES.silver}
        icon={<Star size={18} />}
        tag={<span className="pkg-silver text-xs px-2.5 py-1 rounded-lg">فضية</span>}
        value={formatNumber(stats.silver)}
        rawValue={stats.silver}
        label="باقة فضية"
      />

      <StatCard
        style={CARD_STYLES.gold}
        icon={<Award size={18} />}
        tag={<span className="pkg-gold text-xs px-2.5 py-1 rounded-lg">ذهبية</span>}
        value={formatNumber(stats.gold)}
        rawValue={stats.gold}
        label="باقة ذهبية"
      />

      {canRev && (
        <StatCard
          style={CARD_STYLES.mrr}
          icon={<DollarSign size={18} />}
          tagContent={periodTag}
          value={`$${formatNumber(stats.mrr, 0)}`}
          rawValue={stats.mrr}
          valuePrefix="$"
          label="الإيراد — صافي الفترة"
          sub={
            <p style={{ color: "#5B5FEF", fontSize: 12, fontWeight: 600 }}>صافي بعد الاسترداد</p>
          }
        />
      )}

      {canRev && (
        <StatCard
          style={CARD_STYLES.churn}
          icon={<TrendingDown size={18} />}
          tagContent={periodTag}
          value={`${(stats.churnRate * 100).toFixed(1)}%`}
          rawValue={stats.churnRate * 100}
          valueSuffix="%"
          valueDecimals={1}
          label="نسبة الانسحاب"
          sub={
            stats.churnRate === 0
              ? <p style={{ color: "#5B5FEF", fontSize: 12, fontWeight: 600 }}>لا انسحاب هذا الشهر</p>
              : <p style={{ color: "#EF4444", fontSize: 12, fontWeight: 600 }}>
                  {Math.round(stats.churnRate * 100 * subscribers.length / 100)} منسحب
                </p>
          }
        />
      )}
    </motion.div>
  );
}
