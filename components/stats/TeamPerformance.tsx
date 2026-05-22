"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useActiveEmployees } from "@/features/users/hooks";

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

function RoleBadge({ role, employeeRole }: { role: string; employeeRole?: string }) {
  const isManager = role === "owner" || role === "admin" || employeeRole === "admin" || employeeRole === "team_leader";
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
      background: isManager ? "rgba(91,95,239,.12)" : "rgba(100,116,139,.1)",
      color: isManager ? "#5B5FEF" : "#718096",
      border: `1px solid ${isManager ? "rgba(91,95,239,.22)" : "rgba(100,116,139,.18)"}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {isManager ? "مدير" : "موظف"}
    </span>
  );
}

interface Props { subscribers: Subscriber[] }

export default function TeamPerformance({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");
  const { data: employees = [] } = useActiveEmployees();

  const stats = useMemo(() => {
    return employees
      .map((emp) => {
        const empName = emp.employeeName?.trim() || emp.name?.trim() || "";
        const count   = subscribers.filter((s) => {
          const cv = (s.convincedBy || "").trim();
          return cv === empName || cv === emp.name?.trim();
        }).length;
        const revenue = subscribers
          .filter((s) => {
            const cv = (s.convincedBy || "").trim();
            return cv === empName || cv === emp.name?.trim();
          })
          .reduce((acc, s) => acc + (s.netAmountUSD || 0), 0);

        return { emp, name: empName || emp.name, count, revenue };
      })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [employees, subscribers]);

  const maxCount = Math.max(...stats.map((s) => s.count), 1);

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--jk-divider)" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--jk-text)", lineHeight: 1.2 }}>
          أداء الفريق
        </p>
        <p style={{ fontSize: 13, color: "var(--jk-subtle)", marginTop: 3 }}>
          المشتركون المعيّنون لكل موظف
        </p>
      </div>

      {/* Rows */}
      <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
        {stats.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--jk-subtle)", fontSize: 13, padding: "12px 0" }}>
            لا توجد بيانات
          </p>
        ) : stats.map(({ emp, name, count, revenue }) => {
          const color  = avatarColor(name);
          const pct    = (count / maxCount) * 100;
          const isManager = emp.role === "admin" || emp.role === "owner"
            || emp.employeeRole === "admin" || emp.employeeRole === "team_leader";
          const dotColor = isManager ? "#22C55E" : "#F59E0B";

          return (
            <div key={emp.uid}>
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 10 }}>
                {/* Avatar + dot */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                  }}>
                    {initials(name)}
                  </div>
                  <span style={{
                    position: "absolute", bottom: 1, insetInlineEnd: 1,
                    width: 9, height: 9, borderRadius: "50%",
                    background: dotColor,
                    border: "1.5px solid var(--jk-surface)",
                  }} />
                </div>

                {/* Name + role — grow to fill */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: "var(--jk-text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {name}
                  </span>
                  <RoleBadge role={emp.role} employeeRole={emp.employeeRole} />
                </div>

                {/* Count — far left in RTL */}
                <span style={{
                  fontSize: 15, fontWeight: 800, color: "var(--jk-text)",
                  fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 24, textAlign: "start",
                }}>
                  {count}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 7, background: "var(--jk-panel)",
                borderRadius: 999, overflow: "hidden",
                border: "1px solid var(--jk-divider)",
              }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: color,
                  borderRadius: 999,
                  transition: "width .6s cubic-bezier(.4,0,.2,1)",
                }} />
              </div>

              {/* Revenue */}
              {canRev && (
                <p style={{ fontSize: 12, color: "var(--jk-subtle)", marginTop: 4, textAlign: "start" }}>
                  ${revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
