import { Timestamp } from "firebase/firestore";
import { PackageType } from "./subscriber";

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
  // Breakdowns by employee
  byEmployee?: Record<
    string,
    {
      totalPaymentsUSD: number;
      totalRefundsUSD: number;
      netRevenueUSD: number;
      paymentCount: number;
      refundCount: number;
      withdrawalCount: number;
    }
  >;
  // Breakdowns by package
  byPackage?: Record<
    PackageType,
    {
      totalPaymentsUSD: number;
      totalRefundsUSD: number;
      netRevenueUSD: number;
      paymentCount: number;
      refundCount: number;
      withdrawalCount: number;
    }
  >;
  // Breakdowns by country
  byCountry?: Record<
    string,
    {
      totalPaymentsUSD: number;
      totalRefundsUSD: number;
      netRevenueUSD: number;
      paymentCount: number;
      refundCount: number;
      withdrawalCount: number;
    }
  >;
  updatedAt: Timestamp;
  updatedBy: string;
}
