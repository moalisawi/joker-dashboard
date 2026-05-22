/**
 * Single source of truth for subscriber status colors — Silver Edition palette.
 * All pages and charts must import from here.
 */

export const STATUS_COLORS = {
  active:    { color: "#83A2DB", bg: "rgba(131,162,219,.14)", border: "rgba(131,162,219,.32)" },
  expired:   { color: "#CE6969", bg: "rgba(206,105,105,.12)", border: "rgba(206,105,105,.30)" },
  paused:    { color: "#E8B570", bg: "rgba(232,181,112,.14)", border: "rgba(232,181,112,.32)" },
  frozen:    { color: "#9DB4D6", bg: "rgba(157,180,214,.14)", border: "rgba(157,180,214,.30)" },
  withdrawn: { color: "#94A3B8", bg: "rgba(148,163,184,.14)", border: "rgba(148,163,184,.30)" },
} as const;

/** الترتيب الثابت في الـ donut / pie charts */
export const SUBSCRIBER_STATUS_CHART_COLORS = [
  STATUS_COLORS.active.color,    // نشط
  STATUS_COLORS.expired.color,   // منتهي
  STATUS_COLORS.paused.color,    // موقوف
  STATUS_COLORS.frozen.color,    // مجمّد
  STATUS_COLORS.withdrawn.color, // مسحوب
] as const;

/** ألوان عامة للـ charts بدون تكرار خارج الـ palette */
export const CHART_PALETTE = [
  "#83A2DB", // accent blue
  "#CE6969", // danger red
  "#E8B570", // warn amber
  "#9DB4D6", // frozen blue
  "#94A3B8", // withdrawn gray
  "#64748B", // muted slate
  "#10141A", // primary dark
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
