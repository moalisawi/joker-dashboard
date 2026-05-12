/**
 * Smart Business Insights Engine
 *
 * Pure functions that analyze subscriber + payment data
 * and return actionable insight objects. No Firebase calls.
 */

import type { Subscriber } from "@/types";
import type { Payment }    from "@/types";
import {
  renewalsDue, installmentCompletionRate, retentionRate,
  paymentsThisMonth, paymentsToday, totalNetRevenue,
  employeePerformanceFromSubscribers,
} from "@/lib/analytics/calculations";

export type InsightLevel = "info" | "warning" | "critical" | "success";

export interface Insight {
  id:          string;
  level:       InsightLevel;
  title:       string;
  description: string;
  value?:      string;
  action?:     string;
  actionHref?: string;
}

// ─── Individual insight generators ───────────────────────────────────────────

function renewalsDueInsight(subscribers: Subscriber[]): Insight | null {
  const due = renewalsDue(subscribers, 7);
  if (due.length === 0) return null;
  const level: InsightLevel = due.length >= 5 ? "critical" : due.length >= 2 ? "warning" : "info";
  return {
    id:          "renewals_due",
    level,
    title:       "تجديدات قادمة",
    description: `${due.length} مشترك سينتهي اشتراكه خلال 7 أيام`,
    value:       `${due.length}`,
    action:      "عرض المشتركين",
    actionHref:  "/",
  };
}

function lowInstallmentRateInsight(subscribers: Subscriber[]): Insight | null {
  const rate = installmentCompletionRate(subscribers);
  if (rate >= 0.7) return null;
  return {
    id:          "low_installment",
    level:       rate < 0.5 ? "critical" : "warning",
    title:       "نسبة تحصيل منخفضة",
    description: `نسبة سداد الأقساط ${(rate * 100).toFixed(0)}% — هناك مبالغ معلّقة تحتاج متابعة`,
    value:       `${(rate * 100).toFixed(0)}%`,
  };
}

function retentionInsight(subscribers: Subscriber[]): Insight | null {
  const rate = retentionRate(subscribers);
  if (rate >= 0.7) return {
    id: "good_retention", level: "success",
    title: "معدل احتفاظ جيد",
    description: `${(rate * 100).toFixed(0)}% من المشتركين لا يزالون نشطين`,
    value: `${(rate * 100).toFixed(0)}%`,
  };
  return {
    id:          "low_retention",
    level:       rate < 0.5 ? "critical" : "warning",
    title:       "معدل احتفاظ منخفض",
    description: `${(rate * 100).toFixed(0)}% فقط من المشتركين نشطون — يُوصى بمراجعة أسباب الانسحاب`,
    value:       `${(rate * 100).toFixed(0)}%`,
  };
}

function todayRevenueInsight(payments: Payment[]): Insight | null {
  const today   = paymentsToday(payments);
  const revenue = totalNetRevenue(today);
  if (revenue === 0) return null;
  return {
    id:    "today_revenue",
    level: "success",
    title: "إيراد اليوم",
    description: `تم تحصيل ${revenue.toFixed(0)}$ حتى الآن اليوم`,
    value: `$${revenue.toFixed(0)}`,
  };
}

function topPerformerInsight(subscribers: Subscriber[]): Insight | null {
  const perfs = employeePerformanceFromSubscribers(subscribers);
  if (!perfs.length) return null;
  const top = perfs[0];
  return {
    id:    "top_performer",
    level: "success",
    title: "أفضل موظف هذا الشهر",
    description: `${top.name} — ${top.subscribers} مشترك بإيراد $${top.revenue.toFixed(0)}`,
    value: top.name,
  };
}

function inactiveSubscribersInsight(subscribers: Subscriber[]): Insight | null {
  const paused = subscribers.filter((s) => s.subscriptionStatus === "paused").length;
  if (paused < 3) return null;
  return {
    id:          "paused_subscribers",
    level:       paused >= 10 ? "warning" : "info",
    title:       "مشتركون موقوفون",
    description: `${paused} مشترك موقوف — تحقق من حالتهم`,
    value:       `${paused}`,
  };
}

function noPaymentThisMonthInsight(payments: Payment[]): Insight | null {
  const monthly = paymentsThisMonth(payments);
  if (monthly.length > 0) return null;
  return {
    id:    "no_payments_month",
    level: "warning",
    title: "لا مدفوعات هذا الشهر",
    description: "لم يتم تسجيل أي مدفوعات في الشهر الحالي",
  };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function generateInsights(
  subscribers: Subscriber[],
  payments: Payment[]
): Insight[] {
  const generators = [
    () => renewalsDueInsight(subscribers),
    () => todayRevenueInsight(payments),
    () => lowInstallmentRateInsight(subscribers),
    () => retentionInsight(subscribers),
    () => topPerformerInsight(subscribers),
    () => inactiveSubscribersInsight(subscribers),
    () => noPaymentThisMonthInsight(payments),
  ];

  return generators
    .map((fn) => { try { return fn(); } catch { return null; } })
    .filter((i): i is Insight => i !== null);
}
