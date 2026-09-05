"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Subscriber, PaymentTransaction } from "@/types";
import { UserPlus, DollarSign, Clock, Activity } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

interface Props {
  subscribers: Subscriber[];
  payments?: PaymentTransaction[];
}

type TimelineEvent = {
  id: string;
  type: "subscriber" | "payment" | "expiring";
  title: string;
  subtitle: string;
  date: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
};

function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

export default function ActivityTimeline({ subscribers, payments = [] }: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const events = useMemo<TimelineEvent[]>(() => {
    const result: TimelineEvent[] = [];

    // Recent new subscribers
    // "New subscribers" means newly won, so this timeline orders by when the
    // customer was acquired rather than when their current cycle started.
    [...subscribers]
      .filter((s) => toDateStr(s.firstSubscribedAt ?? s.date))
      .sort((a, b) =>
        toDateStr(b.firstSubscribedAt ?? b.date) > toDateStr(a.firstSubscribedAt ?? a.date) ? 1 : -1
      )
      .slice(0, 8)
      .forEach((s) => {
        result.push({
          id: `sub-${s.id}`,
          type: "subscriber",
          title: s.name,
          subtitle: `اشتراك ${s.package === "ذهبية" ? "ذهبي ✨" : "فضي"} · ${s.status}`,
          date: toDateStr(s.firstSubscribedAt ?? s.date),
          icon: <UserPlus size={13} />,
          iconBg: "#EEF0FF",
          iconColor: "#5B5FEF",
        });
      });

    // Recent payments
    if (canRev) {
      [...payments]
        .filter((p) => toDateStr(p.date))
        .sort((a, b) => (toDateStr(b.date) > toDateStr(a.date) ? 1 : -1))
        .slice(0, 5)
        .forEach((p, idx) => {
          result.push({
            id: `pay-${p.id ?? idx}`,
            type: "payment",
            title: `دفعة — $${(p.amountUSD ?? 0).toFixed(0)}`,
            subtitle: (p as unknown as { subscriberName?: string }).subscriberName ?? "مشترك",
            date: toDateStr(p.date),
            icon: <DollarSign size={13} />,
            iconBg: "#F5F3FF",
            iconColor: "#7C3AED",
          });
        });
    }

    // Expiring soon alerts
    subscribers
      .filter((s) => s.daysRemaining > 0 && s.daysRemaining <= 3 && s.subscriptionState !== "withdrawn")
      .slice(0, 3)
      .forEach((s) => {
        result.push({
          id: `exp-${s.id}`,
          type: "expiring",
          title: s.name,
          subtitle: `ينتهي خلال ${s.daysRemaining} ${s.daysRemaining === 1 ? "يوم" : "أيام"}`,
          date: toDateStr(s.expiryDate ?? ""),
          icon: <Clock size={13} />,
          iconBg: "#FFFBEB",
          iconColor: "#D97706",
        });
      });

    return result
      .sort((a, b) => (b.date > a.date ? 1 : -1))
      .slice(0, 10);
  }, [subscribers, payments, canRev]);

  if (events.length === 0) return null;

  return (
    <div className="panel" style={{ padding: "22px 22px 16px", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: "linear-gradient(135deg, #5B5FEF 0%, #7C3AED 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff",
          boxShadow: "0 4px 12px rgba(91,95,239,0.30)",
        }}>
          <Activity size={13} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.01em" }}>
            آخر النشاطات
          </h3>
          <p style={{ fontSize: 11, color: "var(--jk-subtle)", margin: 0 }}>الأحداث الأخيرة في النظام</p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
          background: "rgba(91,95,239,0.08)", color: "#5B5FEF",
          border: "1px solid rgba(91,95,239,0.15)",
        }}>
          {events.length}
        </span>
      </div>

      {/* Timeline list */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "9px 0",
              borderBottom: i < events.length - 1 ? "1px solid var(--jk-divider)" : "none",
            }}
          >
            {/* Icon container */}
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: event.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: event.iconColor,
              border: `1px solid ${event.iconColor}20`,
            }}>
              {event.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12.5, fontWeight: 700, color: "var(--jk-text)",
                margin: 0, lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {event.title}
              </p>
              <p style={{
                fontSize: 11, color: "var(--jk-subtle)", margin: "2px 0 0",
                lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {event.subtitle}
              </p>
            </div>

            {/* Time */}
            {event.date && (
              <span style={{
                fontSize: 10.5, color: "var(--jk-subtle)", fontWeight: 500,
                flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {timeAgo(event.date)}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
