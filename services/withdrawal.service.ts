/**
 * Withdrawal Service
 * Calculation helpers plus protected server operation for withdrawals.
 */

import { callSubscriberOperation } from "@/lib/clientOperations";
import type { WithdrawalRequest } from "@/types";

export const withdrawalService = {
  calcDaysUsed(startDate: string, toDate?: string): number {
    const from = new Date(startDate).getTime();
    const to = toDate ? new Date(toDate).getTime() : Date.now();
    return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
  },

  calcRemainingDays(expiryDate: string, fromDate?: string): number {
    const from = fromDate ? new Date(fromDate).getTime() : Date.now();
    const to = new Date(expiryDate).getTime();
    return Math.max(0, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
  },

  async withdraw(request: WithdrawalRequest): Promise<void> {
    await callSubscriberOperation("withdrawSubscriber", {
      subscriberId: request.subscriberId,
      reason: request.reason,
      notes: request.notes,
      refundAmount: request.refundAmount ?? 0,
      refundCurrency: request.refundCurrency ?? "USD",
      exchangeRate: request.exchangeRate ?? 1,
    });
  },
};
