"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, PauseCircle, Snowflake, CheckCheck } from "lucide-react";
import type { Subscriber } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { formatNumber } from "@/lib/utils";

interface Props { subscribers: Subscriber[] }

const PALETTE = ["#5B5FEF","#EF4444","#F59E0B","#3B82F6","#22C55E","#6B7280"];

function avatarColor(name: string) {
  const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  return PALETTE[h % PALETTE.length];
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("") || "؟";
}

function DaysBadge({ days }: { days: number }) {
  const urgent = days <= 7;
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 999,
      fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
      background: urgent ? "rgba(239,68,68,.12)" : "rgba(245,158,11,.14)",
      color: urgent ? "#EF4444" : "#F59E0B",
      border: `1px solid ${urgent ? "rgba(239,68,68,.30)" : "rgba(245,158,11,.32)"}`,
    }}>
      {days <= 0 ? "منتهي" : `${days} يوم`}
    </span>
  );
}

function StatusBadge({ type }: { type: "paused" | "frozen" }) {
  const paused = type === "paused";
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      background: paused ? "rgba(245,158,11,.14)" : "rgba(59,130,246,.14)",
      color: paused ? "#F59E0B" : "#3B82F6",
      border: `1px solid ${paused ? "rgba(245,158,11,.32)" : "rgba(59,130,246,.30)"}`,
    }}>
      {paused ? "موقوف" : "مجمد"}
    </span>
  );
}

function OpenBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        padding: "5px 12px", borderRadius: 999,
        border: "1px solid var(--jk-border)",
        background: "var(--jk-surface)", color: "var(--jk-text)",
        fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0,
        boxShadow: "var(--jk-shadow-flat)", transition: "all .15s ease",
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#10141A"; el.style.color = "#fff"; el.style.borderColor = "#10141A"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--jk-surface)"; el.style.color = "var(--jk-text)"; el.style.borderColor = "var(--jk-border)"; }}
    >
      فتح
    </button>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────
interface GroupCardProps {
  title: string;
  subtitle: string;
  items: Subscriber[];
  badgeColor: string;
  badgeBg: string;
  type: "expiring" | "paused" | "frozen";
  onOpen: (s: Subscriber) => void;
}

function GroupCard({ title, subtitle, items, badgeColor, badgeBg, type, onOpen }: GroupCardProps) {
  return (
    <div className="jk-card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "16px 18px 14px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--jk-text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--jk-muted)", marginTop: 4, fontWeight: 500 }}>{subtitle}</div>
        </div>
        <div style={{
          minWidth: 28, height: 28, borderRadius: 999, flexShrink: 0,
          background: badgeBg, color: badgeColor,
          border: `1px solid ${badgeColor}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, padding: "0 8px",
        }}>
          {items.length}
        </div>
      </div>

      {/* Empty */}
      {items.length === 0 ? (
        <div style={{
          padding: "20px 18px", textAlign: "center",
          color: "var(--jk-subtle)", fontSize: 12.5,
          borderTop: "1px solid var(--jk-divider)",
        }}>
          لا يوجد
        </div>
      ) : items.map((s) => {
        const c = avatarColor(s.name);
        return (
          <div
            key={s.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 18px", borderTop: "1px solid var(--jk-divider)",
              transition: "background .12s", cursor: "pointer",
            }}
            onClick={() => onOpen(s)}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--jk-panel)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: c, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>
              {initials(s.name)}
            </div>

            {/* Name + details */}
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{
                fontSize: 13.5, fontWeight: 700, color: "var(--jk-text)", lineHeight: 1.2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {s.name}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--jk-subtle)", marginTop: 2 }}>
                {s.package}{s.convincedBy ? ` · ${s.convincedBy}` : ""}
              </div>
            </div>

            {/* Status + date */}
            <div style={{ textAlign: "end", flexShrink: 0 }}>
              {type === "expiring" && (
                <>
                  <div style={{ fontSize: 11, color: "var(--jk-subtle)", marginBottom: 3 }}>{s.expiryDate}</div>
                  <DaysBadge days={s.daysRemaining} />
                </>
              )}
              {type !== "expiring" && <StatusBadge type={type} />}
            </div>

            {/* Open button */}
            <OpenBtn onClick={() => onOpen(s)} />
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AlertsPanel({ subscribers }: Props) {
  const router     = useRouter();
  const { can }    = useAuthStore();
  const canRev     = can("canViewRevenue");
  const [logRead, setLogRead] = useState(false);

  const expiring = useMemo(() =>
    subscribers
      .filter(s =>
        s.subscriptionState !== "withdrawn" &&
        s.subscriptionStatus !== "paused" &&
        !s.freezeData?.isFrozen &&
        s.daysRemaining <= 30
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 6),
  [subscribers]);

  const paused = useMemo(() =>
    subscribers
      .filter(s => s.subscriptionStatus === "paused" && s.subscriptionState !== "withdrawn")
      .slice(0, 6),
  [subscribers]);

  const frozen = useMemo(() =>
    subscribers
      .filter(s => s.freezeData?.isFrozen === true && s.subscriptionState !== "withdrawn")
      .slice(0, 6),
  [subscribers]);

  const logItems = useMemo(() => [
    ...expiring.map(s => ({ s, type: "expiring" as const })),
    ...paused.map(s  => ({ s, type: "paused"   as const })),
    ...frozen.map(s  => ({ s, type: "frozen"   as const })),
  ], [expiring, paused, frozen]);

  const openSub = (s: Subscriber) => router.push(`/subscribers/${s.id}`);

  const total = expiring.length + paused.length + frozen.length;

  if (total === 0) {
    return (
      <div className="jk-card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999,
          background: "var(--jk-panel)", color: "var(--jk-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
        }}>
          <CheckCheck size={22} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--jk-text)" }}>لا توجد تنبيهات</div>
        <div style={{ fontSize: 13, color: "var(--jk-muted)", marginTop: 6 }}>جميع الاشتراكات بخير</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── 3-column group cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GroupCard
          title="ينتهوون خلال 30 يوماً"
          subtitle="جدد الاشتراك قبل الانتهاء"
          items={expiring}
          badgeColor="#F59E0B"
          badgeBg="rgba(245,158,11,.14)"
          type="expiring"
          onOpen={openSub}
        />
        <GroupCard
          title="المشتركون الموقوفون"
          subtitle="بحاجة لإجراء أو استئناف"
          items={paused}
          badgeColor="#F59E0B"
          badgeBg="rgba(245,158,11,.14)"
          type="paused"
          onOpen={openSub}
        />
        <GroupCard
          title="المشتركون المجمدون"
          subtitle="لا يحتسبون في الإيرادات"
          items={frozen}
          badgeColor="#3B82F6"
          badgeBg="rgba(59,130,246,.14)"
          type="frozen"
          onOpen={openSub}
        />
      </div>

      {/* ── Recent alerts log ── */}
      <div className="jk-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px 14px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          borderBottom: "1px solid var(--jk-divider)",
        }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--jk-text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              سجل التنبيهات الأخيرة
            </div>
            <div style={{ fontSize: 12, color: "var(--jk-muted)", marginTop: 4, fontWeight: 500 }}>
              آخر 24 ساعة
            </div>
          </div>
          <button
            onClick={() => setLogRead(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 999,
              border: "1px solid var(--jk-border)",
              background: logRead ? "var(--jk-panel)" : "var(--jk-surface)",
              color: logRead ? "var(--jk-muted)" : "var(--jk-text)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "var(--jk-shadow-flat)", transition: "all .15s ease",
            }}
          >
            <CheckCheck size={13} />
            تعليم الكل مقروء
          </button>
        </div>

        {/* Log rows */}
        <div>
          {logItems.map(({ s, type }) => {
            const Icon       = type === "expiring" ? Calendar : type === "paused" ? PauseCircle : Snowflake;
            const iconColor  = type === "frozen" ? "#3B82F6" : "#F59E0B";
            const iconBg     = type === "frozen" ? "rgba(59,130,246,.14)" : "rgba(245,158,11,.14)";
            const desc       = type === "expiring"
              ? (s.daysRemaining <= 0 ? "اشتراك منتهي" : `ينتهي خلال ${s.daysRemaining} يوماً`)
              : type === "paused" ? "موقوف · بحاجة لإجراء أو استئناف"
              : "مجمد · لا يحتسب في الإيرادات";

            return (
              <div
                key={`${type}-${s.id}`}
                onClick={() => openSub(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 20px", borderBottom: "1px solid var(--jk-divider)",
                  transition: "background .12s", cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--jk-panel)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Type icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: iconBg, color: iconColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={16} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, color: "var(--jk-text)", lineHeight: 1.2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {s.name} · {s.package}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--jk-muted)", marginTop: 2 }}>{desc}</div>
                </div>

                {/* Amount */}
                {canRev && s.netAmountUSD > 0 && (
                  <div style={{
                    fontSize: 13.5, fontWeight: 800, color: "var(--jk-text)", flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    ${formatNumber(s.netAmountUSD)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
