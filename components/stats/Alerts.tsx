"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { Bell } from "lucide-react";

interface Props { subscribers: Subscriber[] }

const AVATAR_COLORS = [
  "#5B5FEF","#3B82F6","#EF4444","#F59E0B",
  "#9CA3AF","#5B5FEF","#EF4444","#F59E0B",
];

function daysBadge(days: number) {
  if (days <= 3)  return { bg: "rgba(239,68,68,.12)", color: "#EF4444",  border: "rgba(239,68,68,.30)" };
  if (days <= 7)  return { bg: "rgba(245,158,11,.14)", color: "#F59E0B",  border: "rgba(245,158,11,.32)" };
  if (days <= 10) return { bg: "rgba(245,158,11,.14)", color: "#F59E0B",  border: "rgba(245,158,11,.32)" };
  return           { bg: "rgba(91,95,239,.14)", color: "#5B5FEF",  border: "rgba(91,95,239,.32)" };
}

export default function Alerts({ subscribers }: Props) {
  const alerts = useMemo(() =>
    subscribers
      .filter((s) =>
        s.subscriptionState !== "withdrawn" &&
        s.subscriptionStatus !== "paused" &&
        s.freezeData?.isFrozen !== true &&
        (s.status === "ينتهي قريباً" || s.status === "منتهي")
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8),
  [subscribers]);

  return (
    <div className="panel overflow-hidden">
      {/* Header — FIRST → RIGHT in RTL */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px 14px",
        borderBottom: "1px solid var(--border-soft)",
      }}>
        {/* FIRST → RIGHT: title + subtitle */}
        <div>
          <p style={{ fontSize: "var(--fs-heading)", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
            اشتراكات تنتهي قريباً
          </p>
          <p style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)", marginTop: 2 }}>
            خلال 15 يوماً
          </p>
        </div>

        {/* SECOND → LEFT: bell icon */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: "var(--jk-panel)",
          border: "1px solid var(--jk-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bell size={18} style={{ color: "#F59E0B" }} />
        </div>
      </div>

      {/* List */}
      {alerts.length === 0 ? (
        <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          لا توجد تنبيهات
        </div>
      ) : (
        <div>
          {alerts.map((s, idx) => {
            const badge   = daysBadge(s.daysRemaining);
            const avatarC = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const initials = s.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("");
            const label   = s.daysRemaining <= 0
              ? `منتهي منذ ${Math.abs(s.daysRemaining)} يوم`
              : `${s.daysRemaining} أيام`;

            return (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 20px",
                  borderBottom: "1px solid var(--border-soft)",
                  transition: "background .12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* FIRST → RIGHT in RTL: avatar + name + package */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* avatar first → rightmost */}
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${avatarC}, ${avatarC}c0)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    boxShadow: `0 2px 6px ${avatarC}35`,
                  }}>
                    {initials}
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {s.name}
                    </p>
                    <p style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)", marginTop: 2 }}>
                      {s.package}
                    </p>
                  </div>
                </div>

                {/* SECOND → LEFT in RTL: days badge */}
                <span style={{
                  padding: "4px 11px", borderRadius: 999, flexShrink: 0,
                  background: badge.bg, color: badge.color,
                  border: `1px solid ${badge.border}`,
                  fontSize: "var(--fs-caption)", fontWeight: 700,
                  whiteSpace: "nowrap",
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
