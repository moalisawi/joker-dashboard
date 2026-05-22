import type { BaseDocument } from "@/types/base";

export type PaymentMethodScope = "country" | "global";
export type PaymentMethodType = "ewallet" | "bank" | "cash" | "crypto" | "international";
export type PaymentMethodStatus = "active" | "disabled";
export type SupportedCurrency = "USD" | "EGP" | "JOD" | "ILS" | "SAR" | "AED" | "USDT";
export type BalancePeriod = "currentMonth" | "last30" | "lifetime";

export interface PaymentMethod extends BaseDocument {
  name: string;
  scope: PaymentMethodScope;
  country: string | null;
  type: PaymentMethodType;
  supportedCurrencies: SupportedCurrency[];
  holderName: string;
  accountDetails?: string;
  status: PaymentMethodStatus;
  logoUrl?: string;
}

export interface PaymentMethodBalance {
  perCurrency: Partial<Record<SupportedCurrency, number>>;
  totalUSD: number;
  payerCount: number;
  refundedUSD: number;
}

export interface PaymentMethodPayer {
  subscriberId: string;
  subscriberName: string;
  country: string;
  packageType: string;
  paymentDate: string;
  amountOriginal: number;
  currencyOriginal: string;
  amountUSD: number;
  paymentId: string;
}
