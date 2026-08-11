import { Timestamp } from "firebase/firestore";
import { PackageType } from "./subscriber";

/**
 * One row of an analytics breakdown — the same six figures whether the row is
 * an employee, a package or a country. Named so consumers can state what they
 * are handling instead of falling back to `any`, which is what
 * analytics.service.ts did in eleven places.
 */
export interface AnalyticsBreakdown {
  totalPaymentsUSD: number;
  totalRefundsUSD: number;
  netRevenueUSD: number;
  paymentCount: number;
  refundCount: number;
  withdrawalCount: number;
}

/** Monthly aggregated analytics (pre-computed by Cloud Functions) */
export interface MonthlyAnalytics {
  id?: string;
  month: string; // YYYY-MM
  // Totals
  totalPaymentsUSD: number;
  totalRefundsUSD: number;
  netRevenueUSD: number;
  paymentCount: number;
  refundCount: number;
  withdrawalCount: number;
  byEmployee?: Record<string, AnalyticsBreakdown>;
  byPackage?:  Record<PackageType, AnalyticsBreakdown>;
  byCountry?:  Record<string, AnalyticsBreakdown>;
  updatedAt: Timestamp;
  updatedBy: string;
}
