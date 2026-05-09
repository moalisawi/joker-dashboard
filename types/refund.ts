import { Timestamp } from "firebase/firestore";
import { Currency } from "./subscriber";

/** Immutable transaction-based refund record (never mutated after creation) */
export interface RefundTransaction {
  id?: string;
  subscriberId: string;
  subscriberName: string;

  refundAmount: number;
  refundCurrency: Currency;
  exchangeRate: number;
  refundAmountUSD: number;

  refundDate: string; // YYYY-MM-DD
  refundReason: string;
  notes?: string;

  // Links this refund to a withdrawal operation
  relatedWithdrawalId?: string;
  isWithdrawalRefund?: boolean;

  // Always "negative" — affects current-month net revenue downward
  financialImpact: "negative";

  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
}
