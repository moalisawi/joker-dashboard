/**
 * Analytics Service
 * Handle all analytics and reporting queries
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { MonthlyAnalytics, PaymentTransaction, RefundTransaction } from "@/types";

export const analyticsService = {
  /**
   * Get all monthly analytics
   */
  async getAll(): Promise<MonthlyAnalytics[]> {
    const q = query(collection(db, "monthlyAnalytics"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MonthlyAnalytics[];
  },

  /**
   * Get analytics for a specific month (YYYY-MM)
   */
  async getByMonth(month: string): Promise<MonthlyAnalytics | null> {
    const q = query(
      collection(db, "monthlyAnalytics"),
      where("month", "==", month)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty
      ? null
      : (snapshot.docs[0].data() as MonthlyAnalytics);
  },

  /**
   * Get analytics for a date range
   */
  async getByDateRange(startMonth: string, endMonth: string): Promise<MonthlyAnalytics[]> {
    const allAnalytics = await this.getAll();
    return allAnalytics.filter(
      (a) => a.month >= startMonth && a.month <= endMonth
    );
  },

  /**
   * Calculate total revenue for a period
   */
  async getTotalRevenue(startMonth: string, endMonth: string): Promise<number> {
    const analytics = await this.getByDateRange(startMonth, endMonth);
    return analytics.reduce((total, a) => total + a.netRevenueUSD, 0);
  },

  /**
   * Calculate total payments for a period
   */
  async getTotalPayments(startMonth: string, endMonth: string): Promise<number> {
    const analytics = await this.getByDateRange(startMonth, endMonth);
    return analytics.reduce((total, a) => total + a.totalPaymentsUSD, 0);
  },

  /**
   * Calculate total refunds for a period
   */
  async getTotalRefunds(startMonth: string, endMonth: string): Promise<number> {
    const analytics = await this.getByDateRange(startMonth, endMonth);
    return analytics.reduce((total, a) => total + a.totalRefundsUSD, 0);
  },

  /**
   * Get analytics breakdown by employee
   */
  async getByEmployee(month: string): Promise<Record<string, any> | null> {
    const analytics = await this.getByMonth(month);
    return analytics?.byEmployee || null;
  },

  /**
   * Get analytics breakdown by package
   */
  async getByPackage(month: string): Promise<Record<string, any> | null> {
    const analytics = await this.getByMonth(month);
    return analytics?.byPackage || null;
  },

  /**
   * Get analytics breakdown by country
   */
  async getByCountry(month: string): Promise<Record<string, any> | null> {
    const analytics = await this.getByMonth(month);
    return analytics?.byCountry || null;
  },

  /**
   * Calculate refund rate for a period (0-1)
   */
  async getRefundRate(startMonth: string, endMonth: string): Promise<number> {
    const totalPayments = await this.getTotalPayments(startMonth, endMonth);
    const totalRefunds = await this.getTotalRefunds(startMonth, endMonth);
    return totalPayments > 0 ? totalRefunds / totalPayments : 0;
  },

  /**
   * Get top performers (by revenue) for a period
   */
  async getTopPerformers(startMonth: string, endMonth: string, limit: number = 10) {
    const analytics = await this.getByDateRange(startMonth, endMonth);
    
    // Merge employee data across months
    const merged: Record<string, any> = {};
    analytics.forEach((a) => {
      if (a.byEmployee) {
        Object.entries(a.byEmployee).forEach(([employeeId, data]) => {
          if (!merged[employeeId]) {
            merged[employeeId] = { ...data };
          } else {
            merged[employeeId].totalPaymentsUSD += (data as any).totalPaymentsUSD;
            merged[employeeId].totalRefundsUSD += (data as any).totalRefundsUSD;
            merged[employeeId].netRevenueUSD += (data as any).netRevenueUSD;
            merged[employeeId].paymentCount += (data as any).paymentCount;
            merged[employeeId].refundCount += (data as any).refundCount;
          }
        });
      }
    });

    // Sort by net revenue and return top N
    return Object.entries(merged)
      .sort(
        (a, b) => (b[1] as any).netRevenueUSD - (a[1] as any).netRevenueUSD
      )
      .slice(0, limit);
  },
};
