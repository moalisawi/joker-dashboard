"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Subscriber }        from "@/types";
import type { Payment }           from "@/types";
import type { RefundTransaction } from "@/types";
import { formatNumber } from "@/lib/utils";
import { useCountUp } from "@/lib/animations";
import { useAuthStore } from "@/store/authStore";
import {
  Users, TrendingUp, Clock, Star, Award,
  PauseCircle, Snowflake, UserMinus, DollarSign, TrendingDown,
} from "lucide-react";
import { calculateChurnRate } from "@/lib/analytics/calculations";

interface Props {
  subscribers:  Subscriber[];
  payments?:    Payment[];
  refunds?:     RefundTransaction[];
  periodLabel?: string;
}

/* ─── tiny sparkline bar chart ─────────────────────────────── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden", marginTop: 10 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        style={{ height: "100%", background: color, borderRadius: 99 }}
      />
    </div>
  );
}

/* ─── badge chip ────────────────────────────────────────────── */
function Badge({ label, positive, dark }: { label: string; positive?: boolean; dark?: boolean }) {
  if (dark) {
    return (
      <span style={{
        background: positive === false ? "rgba(239,68,68,0.70)" : "rgba(34,197,94,0.70)",
        color: "#fff",
        borderRadius: 999, padding: "3px 10px",
        fontSize: 11, fontWeight: 700,
        backdropFilter: "blur(4px)",
        border: "1px solid rgba(255,255,255,0.2)",
        lineHeight: 1.5, whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    );
  }
  const bg     = positive === false ? "#FEF2F2" : "#ECFDF3";
  const color  = positive === false ? "#EF4444" : "#22C55E";
  const border = positive === false ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.22)";
  return (
    <span style={{
      background: bg, color, borderRadius: 999,
      border: `1px solid ${border}`,
      padding: "3px 10px", fontSize: 11, fontWeight: 700,
      lineHeight: 1.5, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRIMARY HERO CARD — dark gradient, large number, wide visual weight
   ═══════════════════════════════════════════════════════════════ */
function HeroCard({
  icon, badge, badgePositive, value, rawValue, label, sub,
  valuePrefix = "", valueSuffix = "", valueDecimals = 0,
  accent = "#5B5FEF",
}: {
  icon: React.ReactNode; badge?: string; badgePositive?: boolean;
  value: string; rawValue?: number; label: string; sub?: React.ReactNode;
  valuePrefix?: string; valueSuffix?: string; valueDecimals?: number;
  accent?: string;
}) {
  const animated = useCountUp(rawValue ?? 0);
  const display  = rawValue !== undefined
    ? `${valuePrefix}${formatNumber(animated, valueDecimals)}${valueSuffix}`
    : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -5, scale: 1.015 }}
      whileTap={{ scale: 0.975 }}
      className="relative overflow-hidden cursor-default"
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 55%, ${accent}bb 100%)`,
        borderRadius: 24,
        padding: "24px 24px 20px",
        boxShadow: `0 10px 40px ${accent}55, 0 2px 8px rgba(0,0,0,0.12)`,
        minHeight: 162,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        border: `1px solid ${accent}44`,
      }}
    >
      {/* Decorative circles */}
      <span style={{
        position: "absolute", top: -30, right: -30,
        width: 120, height: 120, borderRadius: "50%",
        background: "rgba(255,255,255,0.08)", pointerEvents: "none",
      }} />
      <span style={{
        position: "absolute", bottom: -20, left: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: "rgba(255,255,255,0.05)", pointerEvents: "none",
      }} />

      {/* Top */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: "rgba(255,255,255,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.30)",
          backdropFilter: "blur(4px)",
        }}>
          {icon}
        </div>
        {badge && <Badge label={badge} positive={badgePositive} dark />}
      </div>

      {/* Value + label */}
      <div style={{ position: "relative" }}>
        <p style={{
          color: "#fff", fontSize: 36, fontWeight: 800,
          lineHeight: 1, letterSpacing: "-0.035em",
          fontVariantNumeric: "tabular-nums", margin: 0,
          textShadow: "0 1px 6px rgba(0,0,0,0.18)",
        }}>
          {display}
        </p>
        <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 500, marginTop: 6 }}>
          {label}
        </p>
        {sub && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: "rgba(255,255,255,0.65)", display: "flex", alignItems: "center", gap: 4 }}>
            {sub}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECONDARY STAT CARD — white, subdued
   ═══════════════════════════════════════════════════════════════ */
function StatCard({
  iconColor, icon, badge, badgePositive, value, rawValue, label, sub,
  valuePrefix = "", valueSuffix = "", valueDecimals = 0,
  cardBg, cardBorder, labelColor, barValue, barMax,
  delay = 0,
}: {
  iconColor: string; icon: React.ReactNode; badge?: string; badgePositive?: boolean;
  value: string; rawValue?: number; label: string; sub?: React.ReactNode;
  valuePrefix?: string; valueSuffix?: string; valueDecimals?: number;
  cardBg?: string; cardBorder?: string; labelColor?: string;
  barValue?: number; barMax?: number;
  delay?: number;
}) {
  const animated = useCountUp(rawValue ?? 0);
  const display  = rawValue !== undefined
    ? `${valuePrefix}${formatNumber(animated, valueDecimals)}${valueSuffix}`
    : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.975 }}
      className="group relative cursor-default overflow-hidden"
      style={{
        background: cardBg ?? "var(--jk-surface)",
        border: cardBorder ?? "1px solid var(--jk-border)",
        borderRadius: 24,
        padding: "20px 20px 18px",
        boxShadow: "var(--jk-shadow-stat)",
        minHeight: 148,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        transition: "box-shadow 0.25s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 2px 4px rgba(16,20,26,.04), 0 12px 30px -8px ${iconColor}44`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--jk-shadow-stat)";
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: `${iconColor}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor, flexShrink: 0,
          border: `1px solid ${iconColor}2e`,
        }}>
          {icon}
        </div>
        {badge && <Badge label={badge} positive={badgePositive} />}
      </div>

      {/* Value + label */}
      <div>
        <p style={{
          color: labelColor ? iconColor : "var(--jk-text)",
          fontSize: 28, fontWeight: 800,
          lineHeight: 1, letterSpacing: "-0.028em",
          fontVariantNumeric: "tabular-nums", margin: 0,
        }}>
          {display}
        </p>
        <p style={{ color: labelColor ?? "var(--jk-muted)", fontSize: 12.5, fontWeight: 500, marginTop: 5 }}>
          {label}
        </p>
        {sub && <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--jk-subtle)" }}>{sub}</div>}
        {barValue !== undefined && barMax !== undefined && (
          <MiniBar value={barValue} max={barMax} color={iconColor} />
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */
export default function StatsCards({ subscribers, payments = [], refunds = [], periodLabel }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");
  const periodTag = periodLabel ?? "هذا الشهر";

  const stats = useMemo(() => {
    const total    = subscribers.length;
    const paused   = subscribers.filter((s) => s.subscriptionStatus === "paused").length;
    const frozen   = subscribers.filter((s) => s.freezeData?.isFrozen === true).length;
    const active   = subscribers.filter(
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
    const silver    = subscribers.filter((s) => s.package === "فضية").length;
    const gold      = subscribers.filter((s) => s.package === "ذهبية").length;
    const netUSD    = subscribers
      .filter((s) => s.freezeData?.isFrozen !== true && s.subscriptionState !== "withdrawn")
      .reduce((sum, s) => sum + s.netAmountUSD, 0);
    const remaining = subscribers
      .filter((s) => s.subscriptionState !== "withdrawn")
      .reduce((sum, s) => sum + s.remainingAmountUSD, 0);
    const revenue   = payments.reduce((s, p) => s + (p.amountUSD ?? 0), 0);
    const refunded  = refunds.reduce((s, r) => s + (r.refundAmountUSD ?? 0), 0);
    const mrr       = Math.max(0, revenue - refunded);
    const churnRate = calculateChurnRate(subscribers);
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, expiring, paused, frozen, withdrawn, silver, gold, netUSD, remaining, mrr, churnRate, activeRate };
  }, [subscribers, payments, refunds]);

  return (
    <div className="mb-6">
      {/* ── PRIMARY HERO ROW ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
        {/* Total subscribers — brand primary */}
        <HeroCard
          icon={<Users size={20} />}
          badge={stats.activeRate > 0 ? `${stats.activeRate}% نشط` : "الكل"}
          badgePositive
          value={formatNumber(stats.total)}
          rawValue={stats.total}
          label="إجمالي المشتركين"
          accent="#5B5FEF"
          sub={canRev && (
            <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
              ${formatNumber(stats.netUSD, 0)} إجمالي العقود
            </span>
          )}
        />

        {/* Active — emerald */}
        <HeroCard
          icon={<TrendingUp size={20} />}
          badge={`${stats.active} نشط`}
          badgePositive
          value={formatNumber(stats.active)}
          rawValue={stats.active}
          label="اشتراك نشط"
          accent="#059669"
          sub={
            <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
              {stats.activeRate}% من الإجمالي
            </span>
          }
        />

        {/* Revenue — only for permitted */}
        {canRev ? (
          <HeroCard
            icon={<DollarSign size={20} />}
            badge={periodTag}
            badgePositive
            value={`$${formatNumber(stats.mrr, 0)}`}
            rawValue={stats.mrr}
            valuePrefix="$"
            label="الإيراد الصافي"
            accent="#7C3AED"
            sub={
              <span style={{ color: "rgba(255,255,255,0.75)" }}>صافي بعد الاسترداد</span>
            }
          />
        ) : (
          /* Expiring soon replaces revenue for non-permitted users */
          <HeroCard
            icon={<Clock size={20} />}
            badge={stats.expiring > 0 ? `${stats.expiring} ينتهي` : "لا يوجد"}
            badgePositive={stats.expiring === 0}
            value={formatNumber(stats.expiring)}
            rawValue={stats.expiring}
            label="ينتهي قريباً"
            accent="#D97706"
          />
        )}
      </div>

      {/* ── SECONDARY STATS ROW ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {/* Expiring — only show as secondary if revenue took its spot */}
        {canRev && (
          <StatCard
            iconColor="#F59E0B"
            icon={<Clock size={17} />}
            badge={stats.expiring > 0 ? `${stats.expiring}` : "✓"}
            badgePositive={stats.expiring === 0}
            value={formatNumber(stats.expiring)}
            rawValue={stats.expiring}
            label="ينتهي قريباً"
            delay={0.05}
            sub={canRev && stats.remaining > 0 && (
              <span style={{ color: "#F59E0B" }}>${formatNumber(stats.remaining, 0)} متبقي</span>
            )}
            barValue={stats.expiring}
            barMax={Math.max(stats.total, 1)}
          />
        )}

        {/* Paused */}
        {stats.paused > 0 && (
          <StatCard
            iconColor="#F59E0B"
            icon={<PauseCircle size={17} />}
            badge={`${stats.paused}`}
            badgePositive={false}
            value={formatNumber(stats.paused)}
            rawValue={stats.paused}
            label="موقوف"
            delay={0.08}
            barValue={stats.paused}
            barMax={Math.max(stats.total, 1)}
          />
        )}

        {/* Frozen */}
        {stats.frozen > 0 && (
          <StatCard
            iconColor="#3B82F6"
            icon={<Snowflake size={17} />}
            badge={`${stats.frozen}`}
            badgePositive={false}
            value={formatNumber(stats.frozen)}
            rawValue={stats.frozen}
            label="متجمد"
            delay={0.11}
            barValue={stats.frozen}
            barMax={Math.max(stats.total, 1)}
          />
        )}

        {/* Withdrawn */}
        {stats.withdrawn > 0 && (
          <StatCard
            iconColor="#9CA3AF"
            icon={<UserMinus size={17} />}
            badge={`${stats.withdrawn}`}
            badgePositive={false}
            value={formatNumber(stats.withdrawn)}
            rawValue={stats.withdrawn}
            label="منسحب"
            delay={0.13}
            barValue={stats.withdrawn}
            barMax={Math.max(stats.total, 1)}
          />
        )}

        {/* Silver package */}
        <StatCard
          iconColor="#5A6680"
          icon={<Star size={17} />}
          cardBg="linear-gradient(145deg, #E8ECF4 0%, #F6F8FC 60%, #DDE3EE 100%)"
          cardBorder="1px solid rgba(255,255,255,.85)"
          labelColor="#475569"
          badge="فضية"
          value={formatNumber(stats.silver)}
          rawValue={stats.silver}
          label="باقة فضية"
          delay={0.15}
          barValue={stats.silver}
          barMax={Math.max(stats.total, 1)}
        />

        {/* Gold package */}
        <StatCard
          iconColor="#B07D10"
          icon={<Award size={17} />}
          cardBg="linear-gradient(145deg, #F5E4A8 0%, #FEF7E6 60%, #EDD078 100%)"
          cardBorder="1px solid rgba(210,155,30,.28)"
          labelColor="#92640A"
          badge="ذهبية"
          value={formatNumber(stats.gold)}
          rawValue={stats.gold}
          label="باقة ذهبية"
          delay={0.17}
          barValue={stats.gold}
          barMax={Math.max(stats.total, 1)}
        />

        {/* Churn rate — only for permitted */}
        {canRev && (
          <StatCard
            iconColor="#EF4444"
            icon={<TrendingDown size={17} />}
            badge={`${(stats.churnRate * 100).toFixed(1)}%`}
            badgePositive={stats.churnRate === 0}
            value={`${(stats.churnRate * 100).toFixed(1)}%`}
            rawValue={stats.churnRate * 100}
            valueSuffix="%"
            valueDecimals={1}
            label="نسبة الانسحاب"
            delay={0.2}
            sub={
              stats.churnRate === 0
                ? <span style={{ color: "#22C55E" }}>لا انسحاب</span>
                : <span style={{ color: "#EF4444" }}>
                    {Math.round(stats.churnRate * 100 * subscribers.length / 100)} منسحب
                  </span>
            }
            barValue={stats.churnRate * 100}
            barMax={100}
          />
        )}
      </div>
    </div>
  );
}
