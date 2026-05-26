"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Users, Activity, TrendingUp, Zap, ArrowUpRight, Shield } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { Subscriber, PaymentTransaction } from "@/types";
import { formatNumber } from "@/lib/utils";
import { useCountUp } from "@/lib/animations";

interface Props {
  subscribers: Subscriber[];
  payments?: PaymentTransaction[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "طاب سهرك";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

function getArabicDate() {
  return new Date().toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const animated = useCountUp(value, 1100);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}{formatNumber(animated, decimals)}{suffix}
    </span>
  );
}

export default function DashboardHero({ subscribers, payments = [] }: Props) {
  const { user, can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const stats = useMemo(() => {
    const total = subscribers.length;
    const active = subscribers.filter(
      (s) =>
        s.subscriptionState !== "withdrawn" &&
        s.subscriptionStatus !== "paused" &&
        s.freezeData?.isFrozen !== true &&
        s.status === "نشط"
    ).length;
    const ym = new Date().toISOString().slice(0, 7);
    const lastYm = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      .toISOString().slice(0, 7);
    const thisMonthRev = payments
      .filter((p) => {
        const d = typeof p.date === "string" ? p.date
          : (p.date as unknown as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? "";
        return d.startsWith(ym);
      })
      .reduce((s, p) => s + (p.amountUSD ?? 0), 0);
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const thisMonth = subscribers.filter((s) => {
      const d = typeof s.date === "string" ? s.date : "";
      return d.startsWith(ym);
    }).length;
    const lastMonth = subscribers.filter((s) => {
      const d = typeof s.date === "string" ? s.date : "";
      return d.startsWith(lastYm);
    }).length;
    const growth = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : thisMonth > 0 ? 100 : 0;
    return { total, active, activeRate, thisMonthRev, thisMonth, growth };
  }, [subscribers, payments]);

  const metricCards = [
    {
      icon: <Users size={15} />,
      label: "إجمالي المشتركين",
      value: stats.total,
      prefix: "",
      color: "#8B9CF7",
      badge: null as string | null,
      show: true,
    },
    {
      icon: <Zap size={15} />,
      label: "نشط حالياً",
      value: stats.active,
      prefix: "",
      color: "#4ADE80",
      badge: `${stats.activeRate}%`,
      show: true,
    },
    {
      icon: <TrendingUp size={15} />,
      label: "جديد هذا الشهر",
      value: stats.thisMonth,
      prefix: "",
      color: "#60A5FA",
      badge: stats.growth !== 0 ? `${stats.growth > 0 ? "+" : ""}${stats.growth}%` : null,
      show: true,
    },
    {
      icon: <span style={{ fontSize: 12, fontWeight: 800 }}>$</span>,
      label: "إيراد الشهر",
      value: stats.thisMonthRev,
      prefix: "$",
      color: "#C084FC",
      badge: null as string | null,
      show: canRev,
      isRevenue: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden mb-6"
      style={{
        background: "linear-gradient(135deg, #0F1629 0%, #18213F 38%, #0D1420 68%, #160E2E 100%)",
        borderRadius: 28,
        padding: "clamp(20px, 4vw, 36px) clamp(20px, 4vw, 36px) clamp(18px, 3.5vw, 30px)",
        border: "1px solid rgba(91,95,239,0.22)",
        boxShadow: "0 24px 72px rgba(91,95,239,0.20), 0 6px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Ambient glow orbs ─────────────────────────── */}
      <div style={{
        position: "absolute", top: -80, insetInlineEnd: -80, width: 280, height: 280,
        borderRadius: "50%", filter: "blur(70px)", pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(91,95,239,0.40) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "absolute", bottom: -60, insetInlineStart: 40, width: 200, height: 200,
        borderRadius: "50%", filter: "blur(55px)", pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(139,92,246,0.28) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "absolute", top: "35%", left: "38%", width: 150, height: 150,
        borderRadius: "50%", filter: "blur(45px)", pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(59,130,246,0.16) 0%, transparent 70%)",
      }} />

      {/* ── Subtle grid mesh ───────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 28, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }} />

      {/* ── Shine edge ─────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, insetInlineStart: 0, insetInlineEnd: 0,
        height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        borderRadius: "28px 28px 0 0", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Header row ─────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 24,
          flexWrap: "wrap", gap: 16,
        }}>
          {/* Left: greeting */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}
            >
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em",
                textTransform: "uppercase",
                background: "rgba(91,95,239,0.22)",
                color: "#8B9CF7",
                padding: "4px 12px", borderRadius: 999,
                border: "1px solid rgba(91,95,239,0.32)",
              }}>
                لوحة التحكم الرئيسية
              </span>

              {/* Live pulse indicator */}
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                  <span style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "#22C55E", opacity: 0.5,
                    animation: "jk-ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
                  }} />
                  <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                </span>
                <span style={{ fontSize: 10.5, color: "#4ADE80", fontWeight: 600 }}>مباشر</span>
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              style={{
                fontSize: "clamp(20px, 3.5vw, 32px)",
                fontWeight: 800,
                color: "#FFFFFF",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
              }}
            >
              {getGreeting()}، {user?.name ?? "..."} 👋
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              style={{ color: "rgba(255,255,255,0.38)", fontSize: 12.5, marginTop: 6, fontWeight: 500 }}
            >
              {getArabicDate()}
            </motion.p>
          </div>

          {/* Right: system status badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.32, duration: 0.38, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 18, padding: "12px 18px",
              backdropFilter: "blur(12px)",
              display: "flex", alignItems: "center", gap: 12,
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: "rgba(91,95,239,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#8B9CF7",
              border: "1px solid rgba(91,95,239,0.35)",
            }}>
              <Shield size={15} />
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: 12.5, fontWeight: 700, margin: 0 }}>النظام يعمل</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#22C55E",
                  flexShrink: 0,
                }} />
                <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, margin: 0 }}>جميع الخدمات نشطة</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Metric mini-cards strip ─────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${metricCards.filter(c => c.show).length}, 1fr)`,
          gap: 10,
        }}
          className="hero-metric-grid"
        >
          {metricCards
            .filter((c) => c.show)
            .map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                whileHover={{ scale: 1.03, y: -3 }}
                style={{
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 18,
                  padding: "14px 16px 12px",
                  backdropFilter: "blur(8px)",
                  cursor: "default",
                  transition: "background 0.2s ease, border-color 0.2s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
                  (e.currentTarget as HTMLElement).style.borderColor = `${card.color}30`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.055)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
                }}
              >
                {/* Top: icon + badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: `${card.color}1E`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: card.color,
                    border: `1px solid ${card.color}2C`,
                  }}>
                    {card.icon}
                  </div>
                  {card.badge && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      background: `${card.color}1E`, color: card.color,
                      border: `1px solid ${card.color}2A`,
                      display: "flex", alignItems: "center", gap: 2,
                    }}>
                      <ArrowUpRight size={7} />
                      {card.badge}
                    </span>
                  )}
                </div>

                {/* Value */}
                <p style={{
                  color: "#FFFFFF", fontSize: "clamp(18px, 2.5vw, 26px)",
                  fontWeight: 800, margin: 0, lineHeight: 1,
                  letterSpacing: "-0.022em",
                }}>
                  {(card as { isRevenue?: boolean }).isRevenue
                    ? <AnimatedNumber value={card.value} prefix="$" decimals={0} />
                    : <AnimatedNumber value={card.value} />
                  }
                </p>

                {/* Label */}
                <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 5, fontWeight: 500 }}>
                  {card.label}
                </p>
              </motion.div>
            ))}
        </div>
      </div>

      <style>{`
        @keyframes jk-ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        @media (max-width: 640px) {
          .hero-metric-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
