import { Timestamp } from "firebase/firestore";
import type { Currency } from "./subscriber";

/**
 * Embedded snapshot of withdrawal details stored on the subscriber document.
 * Preserved permanently for audit and history purposes.
 */
export interface WithdrawalData {
  withdrawnAt: Timestamp;
  withdrawnBy: string;
  withdrawnByName: string;
  withdrawalReason: string;
  notes?: string;

  // Refund details (optional — withdrawal may have no refund)
  refundIssued: boolean;
  refundId?: string;
  refundAmount?: number;
  refundCurrency?: Currency;
  refundAmountUSD?: number;
  exchangeRate?: number;

  // Subscription snapshot at time of withdrawal
  originalPlan: string;
  originalExpiryDate: string;
  previousStatus: string;

  // Time accounting
  activeDaysUsed: number;
  remainingDays: number;
}

/**
 * Input payload for executing a withdrawal operation.
 */
export interface WithdrawalRequest {
  subscriberId: string;
  performedBy: string;
  performedByName: string;
  reason: string;
  notes?: string;

  // Optional refund (0 or omitted = withdrawal without refund)
  refundAmount?: number;
  refundCurrency?: Currency;
  refundAmountUSD?: number;
  exchangeRate?: number;
}
