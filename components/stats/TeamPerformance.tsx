"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Subscriber } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useActiveEmployees } from "@/features/users/hooks";
import { Trophy, Users2 } from "lucide-react";

const AVATAR_COLORS = [
  "#5B5FEF", "#F59E0B", "#EF4444", "#3B82F6",
  "#10b981", "#8b5cf6", "#f59e0b", "#ec4899",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "؟";
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

interface Props { subscribers: Subscriber[] }

export default function TeamPerformance({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");
  const { data: employees = [] } = useActiveEmployees();

  const stats = useMemo(() => {
    return employees
      .map((emp) => {
        const empName = emp.employeeName?.trim() || emp.name?.trim() || "";
        const subs    = subscribers.filter((s) => {
          const cv = (s.convincedBy || "").trim();
          return cv === empName || cv === emp.name?.trim();
        });
        const count   = subs.length;
        const revenue = subs.reduce((acc, s) => acc + (s.netAmountUSD || 0), 0);
        return { emp, name: empName || emp.name, count, revenue };
      })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [employees, subscribers]);

  const maxCount   = Math.max(...stats.map((s) => s.count), 1);
  const maxRevenue = Math.max(...stats.map((s) => s.revenue), 1);

  if (stats.length === 0) {
    return (
      <div className="panel" style={{ padding: "20px", textAlign: "center" }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "var(--jk-panel)", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px", color: "var(--jk-subtle)",
        }}>
          <Users2 size={22} />
        </div>
        <p style={{ fontSize: 13, color: "var(--jk-muted)", margin: 0 }}>لا توجد بيانات أداء</p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--jk-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "#FEF7E6", color: "#B07D10",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(176,125,16,0.22)",
          }}>
            <Trophy size={15} />
          </div>
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.015em" }}>
              أداء الفريق
            </h3>
            <p style={{ fontSize: 11.5, color: "var(--jk-subtle)", margin: 0 }}>
              {stats.length} {stats.length === 1 ? "موظف" : "موظفين"} نشطين
            </p>
          </div>
          <span style={{
            marginRight: "auto", fontSize: 11, fontWeight: 700,
            padding: "2px 10px", borderRadius: 999,
            background: "var(--jk-accent-bg)", color: "var(--jk-primary)",
            border: "1px solid var(--jk-accent-border)",
          }}>
            {subscribers.length} مشترك إجمالاً
          </span>
        </div>
      </div>

      {/* Rows */}
      <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {stats.map(({ emp, name, count, revenue }, index) => {
          const color   = avatarColor(name);
          const pct     = (count / maxCount) * 100;
          const revPct  = (revenue / maxRevenue) * 100;
          const isTop   = index === 0;
          const medal   = RANK_MEDALS[index] ?? null;
          const isManager = emp.role === "admin" || emp.role === "owner"
            || emp.employeeRole === "admin" || emp.employeeRole === "team_leader";

          return (
            <motion.div
              key={emp.uid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 10 }}>
                {/* Rank */}
                <span style={{
                  fontSize: isTop ? 18 : 13,
                  width: 24, textAlign: "center", flexShrink: 0,
                  lineHeight: 1,
                }}>
                  {medal ?? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--jk-subtle)" }}>
                      {index + 1}
                    </span>
                  )}
                </span>

                {/* Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isTop
                      ? `linear-gradient(135deg, ${color}, ${color}cc)`
                      : color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, color: "#fff",
                    boxShadow: isTop ? `0 4px 12px ${color}55` : "none",
                    border: isTop ? `2px solid ${color}44` : "none",
                  }}>
                    {initials(name)}
                  </div>
                  <span style={{
                    position: "absolute", bottom: 1, insetInlineEnd: 1,
                    width: 9, height: 9, borderRadius: "50%",
                    background: isManager ? "#22C55E" : "#F59E0B",
                    border: "1.5px solid var(--jk-surface)",
                  }} />
                </div>

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 13.5, fontWeight: 700, color: "var(--jk-text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      background: isManager ? "rgba(91,95,239,.10)" : "rgba(100,116,139,.10)",
                      color: isManager ? "#5B5FEF" : "#718096",
                      border: `1px solid ${isManager ? "rgba(91,95,239,.18)" : "rgba(100,116,139,.15)"}`,
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {isManager ? "مدير" : "موظف"}
                    </span>
                  </div>
                </div>

                {/* Count */}
                <div style={{ textAlign: "start", flexShrink: 0 }}>
                  <span style={{
                    fontSize: 17, fontWeight: 800, color: isTop ? color : "var(--jk-text)",
                    fontVariantNumeric: "tabular-nums", display: "block", lineHeight: 1,
                  }}>
                    {count}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--jk-subtle)", fontWeight: 600 }}>مشترك</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ paddingInlineStart: 34 }}>
                <div style={{
                  height: 6, background: "var(--jk-panel)",
                  borderRadius: 999, overflow: "hidden",
                  border: "1px solid var(--jk-divider)",
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.15 + index * 0.05 }}
                    style={{
                      height: "100%", background: color,
                      borderRadius: 999,
                      boxShadow: isTop ? `0 0 6px ${color}66` : "none",
                    }}
                  />
                </div>

                {/* Revenue */}
                {canRev && revenue > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                    <div style={{
                      height: 3, flex: 1, background: "var(--jk-panel)",
                      borderRadius: 999, overflow: "hidden", marginInlineEnd: 8,
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${revPct}%` }}
                        transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], delay: 0.2 + index * 0.05 }}
                        style={{
                          height: "100%",
                          background: `linear-gradient(90deg, ${color}88, ${color}44)`,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--jk-subtle)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      ${revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
