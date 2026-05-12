"use client";

import { useMemo } from "react";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments }    from "@/hooks/usePayments";
import { useRefunds }     from "@/hooks/useRefunds";
import {
  totalNetRevenue, totalCollected, totalPendingInstallments,
  renewalsDue, installmentCompletionRate, retentionRate,
  paymentsThisMonth, paymentsToday, revenueByMonth,
  packageBreakdown, averageCustomerValue,
} from "@/lib/analytics/calculations";
import { generateInsights } from "@/lib/analytics/insights";

export function useDashboardMetrics() {
  const { subscribers, loading: loadingSubs } = useSubscribers();
  const { payments,    loading: loadingPay  } = usePayments({});
  const { refunds,     loading: loadingRef  } = useRefunds({});

  const loading = loadingSubs || loadingPay || loadingRef;

  const metrics = useMemo(() => {
    const active     = subscribers.filter((s) => s.subscriptionState === "active");
    const paused     = subscribers.filter((s) => s.subscriptionStatus === "paused");
    const withdrawn  = subscribers.filter((s) => s.subscriptionState === "withdrawn");
    const monthlyPay = paymentsThisMonth(payments);
    const todayPay   = paymentsToday(payments);
    const dueSoon    = renewalsDue(subscribers, 7);

    return {
      // Subscriber counts
      totalSubscribers:  subscribers.length,
      activeSubscribers: active.length,
      pausedSubscribers: paused.length,
      cancelledSubscribers: withdrawn.length,

      // Revenue
      totalRevenue:       totalNetRevenue(payments),
      totalCollected:     totalCollected(payments),
      monthlyRevenue:     totalNetRevenue(monthlyPay),
      todayRevenue:       totalNetRevenue(todayPay),

      // Installments
      pendingInstallments: totalPendingInstallments(subscribers),

      // Renewals
      renewalsDue:         dueSoon.length,
      renewalsDueList:     dueSoon,

      // Rates
      installmentRate:     installmentCompletionRate(subscribers),
      retentionRate:       retentionRate(subscribers),
      avgCustomerValue:    averageCustomerValue(subscribers),

      // Charts
      revenueByMonth:   revenueByMonth(payments, 12),
      packageBreakdown: packageBreakdown(subscribers),

      // Refunds
      totalRefunds:   refunds.reduce((s, r) => s + (r.refundAmountUSD ?? 0), 0),
      refundCount:    refunds.length,
    };
  }, [subscribers, payments, refunds]);

  const insights = useMemo(
    () => generateInsights(subscribers, payments),
    [subscribers, payments]
  );

  return { metrics, insights, loading, subscribers, payments, refunds };
}
