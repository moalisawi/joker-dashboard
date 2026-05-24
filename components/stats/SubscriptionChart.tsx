"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Subscriber } from "@/types";
import type { Payment } from "@/types";
import { formatNumber, ARABIC_MONTHS } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { BarChart3 } from "lucide-react";

function toStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

interface Props {
  subscribers: Subscriber[];
  payments?:   Payment[];
}

type ChartMode = "subscriptions" | "revenue";

/* Custom tooltip */
function CustomTooltip({ active, payload, label, mode }: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string;
  mode: ChartMode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(17,24,39,0.92)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
      pointerEvents: "none",
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>
          {mode === "revenue" ? `$${formatNumber(entry.value as number, 0)}` : `${entry.value} اشتراك`}
        </p>
      ))}
    </div>
  );
}

export default function SubscriptionChart({ subscribers, payments = [] }: Props) {
  const { can }  = useAuthStore();
  const canRev   = can("canViewRevenue");
  const [mode, setMode] = useState<ChartMode>("subscriptions");

  /* Build last-12-months data */
  const chartData = useMemo(() => {
    const now    = new Date();
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const subs = subscribers.filter((s) => toStr(s.date).startsWith(ym)).length;
      const rev  = payments
        .filter((p) => toStr(p.date).startsWith(ym))
        .reduce((sum, p) => sum + (p.amountUSD ?? 0), 0);
      result.push({
        month: ARABIC_MONTHS[d.getMonth()].slice(0, 3),
        fullMonth: `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        subscriptions: subs,
        revenue: rev,
      });
    }
    return result;
  }, [subscribers, payments]);

  const total = mode === "subscriptions"
    ? chartData.reduce((s, d) => s + d.subscriptions, 0)
    : chartData.reduce((s, d) => s + d.revenue, 0);

  const isRevMode = mode === "revenue";

  const tabs: { key: ChartMode; label: string }[] = [
    { key: "subscriptions", label: "الاشتراكات" },
    ...(canRev ? [{ key: "revenue" as ChartMode, label: "الإيرادات" }] : []),
  ];

  return (
    <div className="panel" style={{ padding: "20px 22px 18px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "var(--jk-accent-bg)", color: "var(--jk-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--jk-accent-border)",
          }}>
            <BarChart3 size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.015em" }}>
              نمو الاشتراكات
            </h3>
            <p style={{ fontSize: 12, color: "var(--jk-subtle)", margin: 0 }}>
              آخر 12 شهر
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Total chip */}
          <span style={{
            fontSize: 13, fontWeight: 800, color: "var(--jk-text)",
            letterSpacing: "-0.02em",
          }}>
            {isRevMode ? `$${formatNumber(total, 0)}` : formatNumber(total)}
          </span>

          {/* Mode tabs */}
          {tabs.length > 1 && (
            <div style={{
              display: "flex", gap: 2,
              background: "var(--jk-panel)", borderRadius: 999, padding: 3,
              border: "1px solid var(--jk-divider)",
            }}>
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  style={{
                    padding: "5px 14px", borderRadius: 999, border: "none",
                    background: mode === key ? "var(--jk-primary)" : "transparent",
                    color: mode === key ? "#fff" : "var(--jk-muted)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "all .15s ease",
                    boxShadow: mode === key ? "0 4px 10px rgba(91,95,239,0.28)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        style={{ height: 200, marginInline: -6 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {isRevMode ? (
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.30} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--jk-divider)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "var(--jk-subtle)", fontSize: 10, fontWeight: 600 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--jk-subtle)", fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <CustomTooltip active={active} payload={payload} label={label as string} mode="revenue" />
                )}
                cursor={{ fill: "rgba(124,58,237,0.06)" }}
              />
              <Bar dataKey="revenue" fill="url(#revGrad)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#5B5FEF" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="#5B5FEF" stopOpacity={0.00} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--jk-divider)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "var(--jk-subtle)", fontSize: 10, fontWeight: 600 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--jk-subtle)", fontSize: 10 }}
                axisLine={false} tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <CustomTooltip active={active} payload={payload} label={label as string} mode="subscriptions" />
                )}
                cursor={{ stroke: "rgba(91,95,239,0.20)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="subscriptions"
                stroke="#5B5FEF"
                strokeWidth={2.5}
                fill="url(#subGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "#5B5FEF", strokeWidth: 0 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
