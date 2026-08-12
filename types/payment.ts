import { Timestamp } from "firebase/firestore";
import { Currency} from "./subscriber";
import type { ReceiptStatus, SettlementStatus } from "./billing";

export type PaymentType = "initial" | "installment" | "renewal" | "refund";

/**
 * Fields shared by both payment shapes below, added with the billing ledger.
 *
 * All optional, and all absent on every payment written before this existed —
 * which is the point. A payment carrying no `receiptStatus` is not broken; it
 * simply predates receipt tracking, and `resolveReceiptStatus()` derives a
 * sensible value from whether a `receiptUrl` is present.
 *
 * None of these change what a payment *means* financially. `amountUSD` still
 * counts toward the balance the moment the payment is recorded, whatever the
 * receipt or settlement state says.
 */
export interface PaymentLedgerFields {
  /** The cycle this payment belongs to. Absent on pre-ledger payments. */
  cycleId?: string | null;
  cycleNumber?: number | null;
  invoiceId?: string | null;
  /** Instalments this payment was applied to, with the amount applied to each. */
  installmentAllocations?: { installmentId: string; installmentNumber: number; appliedUSD: number }[];

  // ── Receipt ──
  receiptFileName?: string | null;
  /** Internal, human-quotable reference for this payment. */
  receiptNumber?: string | null;
  /** The bank/wallet transfer number the customer quotes. */
  externalReference?: string | null;
  receiptStatus?: ReceiptStatus;
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: Timestamp | null;
  rejectionReason?: string | null;

  // ── Reconciliation ──
  settlementStatus?: SettlementStatus;
  reconciledAt?: Timestamp | null;
  reconciledBy?: string | null;
  settlementBatchId?: string | null;
}

export interface Payment extends PaymentLedgerFields {
  subscriberId: string;
  subscriberName: string;
  amountOriginal: number;
  currencyOriginal: Currency;
  exchangeRate: number;
  amountUSD: number;
  paymentMethod: string;
  paymentMethodId?: string;
  paymentType?: PaymentType;
  receiptUrl?: string | null;
  receiptType?: string | null;
  date: string;
  notes?: string | null;
  isInitialPayment?: boolean;
  isRenewalPayment?: boolean;
  renewalNumber?: number;
  createdAt?: Timestamp;
  createdBy?: string;
}

/** Transaction-based payment record (immutable) */
export interface PaymentTransaction extends PaymentLedgerFields {
  id?: string;
  subscriberId: string;
  subscriberName: string;
  amountOriginal: number;
  currencyOriginal: Currency;
  exchangeRate: number;
  amountUSD: number;
  paymentMethod: string;
  paymentMethodId?: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  receiptUrl?: string | null;
  receiptType?: string | null;
  isInitialPayment: boolean;
  isRenewalPayment: boolean;
  renewalNumber?: number;
  createdAt: Timestamp;
  createdBy: string;
}
