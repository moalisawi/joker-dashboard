"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { Bell } from "lucide-react";

interface Props { subscribers: Subscriber[] }

const AVATAR_COLORS = [
  "#83A2DB","#9DB4D6","#CE6969","#E8B570",
  "#94A3B8","#83A2DB","#CE6969","#E8B570",
];

function daysBadge(days: number) {
  if (days <= 3)  return { bg: "rgba(206,105,105,.12)", color: "#CE6969",  border: "rgba(206,105,105,.30)" };
  if (days <= 7)  return { bg: "rgba(232,181,112,.14)", color: "#E8B570",  border: "rgba(232,181,112,.32)" };
  if (days <= 10) return { bg: "rgba(232,181,112,.14)", color: "#E8B570",  border: "rgba(232,181,112,.32)" };
  return           { bg: "rgba(131,162,219,.14)", color: "#83A2DB",  border: "rgba(131,162,219,.32)" };
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
          <Bell size={18} style={{ color: "#E8B570" }} />
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
