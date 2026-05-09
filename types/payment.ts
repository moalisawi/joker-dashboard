import { Timestamp } from "firebase/firestore";
import { Currency, PackageType } from "./subscriber";

export type PaymentType = "initial" | "installment" | "renewal" | "refund";

export interface Payment {
  subscriberId: string;
  subscriberName: string;
  amountOriginal: number;
  currencyOriginal: Currency;
  exchangeRate: number;
  amountUSD: number;
  paymentMethod: string;
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
export interface PaymentTransaction {
  id?: string;
  subscriberId: string;
  subscriberName: string;
  amountOriginal: number;
  currencyOriginal: Currency;
  exchangeRate: number;
  amountUSD: number;
  paymentMethod: string;
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
