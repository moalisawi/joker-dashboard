/**
 * Single source of truth for subscriber status colors — DESIGN.md palette.
 * All pages and charts must import from here.
 */

export const STATUS_COLORS = {
  active:    { color: "#22C55E", bg: "#ECFDF3",  border: "rgba(34,197,94,0.30)"   },
  expired:   { color: "#EF4444", bg: "#FEF2F2",  border: "rgba(239,68,68,0.30)"   },
  paused:    { color: "#F59E0B", bg: "#FFFBEB",  border: "rgba(245,158,11,0.30)"  },
  frozen:    { color: "#3B82F6", bg: "#EFF6FF",  border: "rgba(59,130,246,0.30)"  },
  withdrawn: { color: "#9CA3AF", bg: "#F1F5F9",  border: "rgba(156,163,175,0.30)" },
} as const;

/** الترتيب الثابت في الـ donut / pie charts */
export const SUBSCRIBER_STATUS_CHART_COLORS = [
  STATUS_COLORS.active.color,    // نشط
  STATUS_COLORS.expired.color,   // منتهي
  STATUS_COLORS.paused.color,    // موقوف
  STATUS_COLORS.frozen.color,    // مجمّد
  STATUS_COLORS.withdrawn.color, // مسحوب
] as const;

/** ألوان عامة للـ charts — DESIGN.md palette */
export const CHART_PALETTE = [
  "#5B5FEF", // primary blue
  "#22C55E", // success green
  "#F59E0B", // warning amber
  "#EF4444", // danger red
  "#8B5CF6", // purple
  "#06B6D4", // cyan
  "#3B82F6", // info blue
  "#9CA3AF", // muted gray
] as const;

export function getStatusColor(status: string) {
  if (status === "نشط" || status === "active")             return STATUS_COLORS.active;
  if (status === "ينتهي قريباً" || status === "expiring")  return STATUS_COLORS.paused;
  if (status === "منتهي" || status === "expired")          return STATUS_COLORS.expired;
  if (status === "موقوف" || status === "paused")           return STATUS_COLORS.paused;
  if (status === "متجمد" || status === "frozen")           return STATUS_COLORS.frozen;
  return STATUS_COLORS.withdrawn;
}

export function getStatusClass(status: string): string {
  if (status === "نشط")           return "status-active";
  if (status === "ينتهي قريباً")  return "status-expiring";
  if (status === "منتهي")         return "status-expired";
  if (status === "موقوف")         return "status-paused";
  if (status === "متجمد")         return "status-frozen";
  return "status-withdrawn";
}
