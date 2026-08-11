"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Subscriber } from "@/types";
import type { Payment } from "@/types";
import { useAuthStore } from "@/store/authStore";
import {
  TrendingUp, AlertTriangle, Trophy, Zap, Clock,
   DollarSign, ArrowUpRight, ArrowDownRight} from "lucide-react";

interface Props {
  subscribers: Subscriber[];
  payments?: Payment[];
}

function toStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

interface Insight {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  trend?: "up" | "down" | "neutral";
}

function InsightCard({ insight, delay }: { insight: Insight; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1], delay }}
      whileHover={{ y: -3, scale: 1.015 }}
      style={{
        background: "var(--jk-surface)",
        border: "1px solid var(--jk-border)",
        borderRadius: 20,
        padding: "16px 18px",
        boxShadow: "var(--jk-shadow-stat)",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        cursor: "default",
        transition: "box-shadow 0.2s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 2px 4px rgba(16,20,26,.04), 0 12px 28px -8px ${insight.iconColor}35`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--jk-shadow-stat)";
      }}
    >
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: insight.iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: insight.iconColor, flexShrink: 0,
        border: `1px solid ${insight.iconColor}22`,
      }}>
        {insight.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--jk-text)", margin: 0 }}>
            {insight.title}
          </p>
          {insight.badge && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
              background: insight.badgeBg ?? "#ECFDF3",
              color: insight.badgeColor ?? "#22C55E",
              whiteSpace: "nowrap", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              {insight.trend === "up" && <ArrowUpRight size={9} />}
              {insight.trend === "down" && <ArrowDownRight size={9} />}
              {insight.badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--jk-subtle)", margin: 0, lineHeight: 1.55 }}>
          {insight.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function SmartInsights({ subscribers, payments = [] }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const now    = new Date();
    const today  = now.toISOString().split("T")[0];
    const ym     = today.slice(0, 7);

    const total    = subscribers.length;
    const active   = subscribers.filter(
      (s) => s.subscriptionState !== "withdrawn" &&
             s.subscriptionStatus !== "paused" &&
             s.freezeData?.isFrozen !== true &&
             s.status === "نشط"
    ).length;
    const expiring1  = subscribers.filter(
      (s) => s.daysRemaining === 1 && s.subscriptionState !== "withdrawn"
    ).length;
    const expiring3  = subscribers.filter(
      (s) => s.daysRemaining > 0 && s.daysRemaining <= 3 && s.subscriptionState !== "withdrawn"
    ).length;
    const expiring7  = subscribers.filter(
      (s) => s.daysRemaining > 0 && s.daysRemaining <= 7 && s.subscriptionState !== "withdrawn"
    ).length;
    const thisMonth  = subscribers.filter((s) => toStr(s.date).startsWith(ym)).length;
    const lastMonthYm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString().slice(0, 7);
    const lastMonth  = subscribers.filter((s) => toStr(s.date).startsWith(lastMonthYm)).length;
    const growthPct  = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : thisMonth > 0 ? 100 : 0;

    /* Best performer */
    const empMap: Record<string, number> = {};
    subscribers.forEach((s) => {
      if (s.convincedBy) empMap[s.convincedBy] = (empMap[s.convincedBy] ?? 0) + 1;
    });
    const topEmp = Object.entries(empMap).sort((a, b) => b[1] - a[1])[0];

    /* Active rate */
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

    /* ── Build insights ── */

    if (expiring1 > 0) {
      result.push({
        id: "expiring-today",
        icon: <AlertTriangle size={16} />,
        iconBg: "#FEF2F2", iconColor: "#EF4444",
        title: "انتهاء اليوم",
        description: `${expiring1} اشتراك ${expiring1 === 1 ? "ينتهي" : "تنتهي"} اليوم — تواصل الآن لتجديد الاشتراك.`,
        badge: `${expiring1}`,
        badgeColor: "#EF4444", badgeBg: "#FEF2F2",
        trend: "down",
      });
    }

    if (expiring3 > 0 && expiring1 === 0) {
      result.push({
        id: "expiring-3",
        icon: <Clock size={16} />,
        iconBg: "#FFFBEB", iconColor: "#D97706",
        title: "ينتهي خلال 3 أيام",
        description: `${expiring3} اشتراك على وشك الانتهاء — فرصة جيدة للتجديد المبكر.`,
        badge: `${expiring3} قريباً`,
        badgeColor: "#D97706", badgeBg: "#FFFBEB",
        trend: "down",
      });
    } else if (expiring7 > expiring3) {
      result.push({
        id: "expiring-7",
        icon: <Clock size={16} />,
        iconBg: "#FFFBEB", iconColor: "#D97706",
        title: "ينتهي هذا الأسبوع",
        description: `${expiring7} اشتراك سينتهي خلال 7 أيام القادمة.`,
        badge: `${expiring7}`,
        badgeColor: "#D97706", badgeBg: "#FFFBEB",
        trend: "neutral",
      });
    }

    if (growthPct !== 0) {
      result.push({
        id: "growth",
        icon: <TrendingUp size={16} />,
        iconBg: growthPct > 0 ? "#ECFDF3" : "#FEF2F2",
        iconColor: growthPct > 0 ? "#22C55E" : "#EF4444",
        title: "نمو الاشتراكات",
        description: growthPct > 0
          ? `ارتفعت الاشتراكات ${growthPct}% مقارنةً بالشهر الماضي — ${thisMonth} اشتراك جديد هذا الشهر.`
          : `تراجعت الاشتراكات ${Math.abs(growthPct)}% مقارنةً بالشهر الماضي.`,
        badge: `${growthPct > 0 ? "+" : ""}${growthPct}%`,
        badgeColor: growthPct > 0 ? "#22C55E" : "#EF4444",
        badgeBg: growthPct > 0 ? "#ECFDF3" : "#FEF2F2",
        trend: growthPct > 0 ? "up" : "down",
      });
    }

    if (topEmp) {
      result.push({
        id: "top-performer",
        icon: <Trophy size={16} />,
        iconBg: "#FEF7E6", iconColor: "#B07D10",
        title: "الأفضل هذا الشهر",
        description: `${topEmp[0]} حقّق ${topEmp[1]} اشتراك — أعلى أداء في الفريق.`,
        badge: `${topEmp[1]} اشتراك`,
        badgeColor: "#B07D10", badgeBg: "#FEF7E6",
        trend: "up",
      });
    }

    result.push({
      id: "active-rate",
      icon: <Zap size={16} />,
      iconBg: "#EEF0FF", iconColor: "#5B5FEF",
      title: "معدل الاشتراكات النشطة",
      description: `${activeRate}% من المشتركين نشطون حالياً — ${active} من ${total} مشترك.`,
      badge: `${activeRate}%`,
      badgeColor: "#5B5FEF", badgeBg: "#EEF0FF",
      trend: activeRate >= 70 ? "up" : "neutral",
    });

    if (canRev && payments.length > 0) {
      const thisMonthRev = payments
        .filter((p) => toStr(p.date).startsWith(ym))
        .reduce((s, p) => s + (p.amountUSD ?? 0), 0);
      if (thisMonthRev > 0) {
        result.push({
          id: "revenue",
          icon: <DollarSign size={16} />,
          iconBg: "#F5F3FF", iconColor: "#7C3AED",
          title: "إيراد الشهر الحالي",
          description: `تم تحصيل $${thisMonthRev.toLocaleString("en-US", { maximumFractionDigits: 0 })} حتى الآن هذا الشهر.`,
          badge: `$${thisMonthRev.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
          badgeColor: "#7C3AED", badgeBg: "#F5F3FF",
          trend: "up",
        });
      }
    }

    return result.slice(0, 6);
  }, [subscribers, payments, canRev]);

  if (insights.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, #5B5FEF, #7C3AED)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", flexShrink: 0,
        }}>
          <Zap size={14} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.01em" }}>
            ذكاء لوحة التحكم
          </h3>
          <p style={{ fontSize: 11.5, color: "var(--jk-subtle)", margin: 0 }}>
            رؤى تلقائية محدّثة لحظياً
          </p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
          background: "linear-gradient(135deg, #5B5FEF22, #7C3AED22)",
          color: "#5B5FEF", border: "1px solid #5B5FEF33",
          marginRight: "auto",
        }}>
          AI
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((insight, i) => (
          <InsightCard key={insight.id} insight={insight} delay={i * 0.06} />
        ))}
      </div>
    </div>
  );
}
