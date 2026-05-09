"use client";

import { Subscriber } from "@/types";

/**
 * Migration helpers for transitioning from subscriber-based refund tracking
 * to transaction-based accounting system
 */

/**
 * Check if a subscriber has legacy refund data that needs to be migrated
 */
export function hasLegacyRefundData(subscriber: Subscriber): boolean {
  return !!(
    subscriber.refundAmount ||
    subscriber.refundAmountUSD ||
    subscriber.refundCurrency ||
    subscriber.refundRate
  );
}

/**
 * Extract legacy refund information from subscriber for display purposes
 * Used in fallback scenarios when refunds collection hasn't been populated yet
 */
export function getLegacyRefundInfo(subscriber: Subscriber) {
  return {
    refundAmount: subscriber.refundAmount || 0,
    refundAmountUSD: subscriber.refundAmountUSD || 0,
    refundCurrency: subscriber.refundCurrency || "USD",
    refundRate: subscriber.refundRate || 1,
    hasLegacyData: hasLegacyRefundData(subscriber),
  };
}

/**
 * Calculate financial status considering both transaction-based and legacy data
 * Prefers transaction-based data if available
 */
export interface FinancialStatus {
  paidAmountUSD: number;
  totalRefundsUSD: number;
  netRevenueUSD: number;
  source: "transactions" | "legacy";
  migrationNote?: string;
}

export function calculateFinancialStatus(
  subscriber: Subscriber,
  transactionRefundsUSD: number = 0
): FinancialStatus {
  const paidAmountUSD = subscriber.paidAmountUSD || 0;

  // Prefer transaction-based refunds if available
  if (transactionRefundsUSD > 0) {
    return {
      paidAmountUSD,
      totalRefundsUSD: transactionRefundsUSD,
      netRevenueUSD: Math.max(0, paidAmountUSD - transactionRefundsUSD),
      source: "transactions",
    };
  }

  // Fallback to legacy data
  const legacyRefunds = getLegacyRefundInfo(subscriber);
  if (legacyRefunds.hasLegacyData) {
    return {
      paidAmountUSD,
      totalRefundsUSD: legacyRefunds.refundAmountUSD,
      netRevenueUSD: Math.max(
        0,
        paidAmountUSD - legacyRefunds.refundAmountUSD
      ),
      source: "legacy",
      migrationNote:
        "Data from legacy refund field. Consider migrating to transactions collection.",
    };
  }

  // No refunds
  return {
    paidAmountUSD,
    totalRefundsUSD: 0,
    netRevenueUSD: paidAmountUSD,
    source: "transactions",
  };
}

/**
 * Suggest migration actions for a subscriber
 */
export function suggestMigrationActions(
  subscriber: Subscriber,
  transactionRefundsUSD: number = 0
): string[] {
  const actions: string[] = [];

  if (
    hasLegacyRefundData(subscriber) &&
    transactionRefundsUSD === 0
  ) {
    actions.push(
      "Create refund transaction from legacy data in refunds collection"
    );
  }

  if (
    subscriber.subscriptionState === "withdrawn" &&
    !subscriber.withdrawalDate
  ) {
    actions.push("Add withdrawalDate to subscriber record");
  }

  if (subscriber.subscriptionState === "withdrawn" && !subscriber.withdrawalReason) {
    actions.push("Add withdrawalReason to subscriber record");
  }

  return actions;
}

/**
 * Generate migration report for a batch of subscribers
 */
export function generateMigrationReport(subscribers: Subscriber[]) {
  const totalSubscribers = subscribers.length;
  const legacyRefundCount = subscribers.filter(hasLegacyRefundData).length;
  const withdrawnWithoutDates = subscribers.filter(
    (s) => s.subscriptionState === "withdrawn" && !s.withdrawalDate
  ).length;

  const totalLegacyRefundsUSD = subscribers.reduce((sum, s) => {
    if (hasLegacyRefundData(s)) {
      return sum + (s.refundAmountUSD || 0);
    }
    return sum;
  }, 0);

  return {
    totalSubscribers,
    legacyRefundCount,
    legacyRefundPercentage: (
      (legacyRefundCount / totalSubscribers) *
      100
    ).toFixed(1),
    totalLegacyRefundsUSD,
    withdrawnWithoutDates,
    status:
      legacyRefundCount === 0
        ? "✅ All subscribers migrated"
        : `⚠️ ${legacyRefundCount} subscribers have legacy refund data`,
  };
}
