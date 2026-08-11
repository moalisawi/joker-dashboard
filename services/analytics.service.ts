/**
 * Analytics Service
 * Handle all analytics and reporting queries
 */

import {
  collection,
  query,
  
  getDocs,
  doc,
  getDoc} from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { MonthlyAnalytics, AnalyticsBreakdown } from "@/types";

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
   * Get analytics for a specific month (YYYY-MM).
   * Document ID IS the month string, so use getDoc instead of a field query.
   */
  async getByMonth(month: string): Promise<MonthlyAnalytics | null> {
    const snap = await getDoc(doc(db, "monthlyAnalytics", month));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as MonthlyAnalytics) : null;
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
  async getByEmployee(month: string): Promise<Record<string, AnalyticsBreakdown> | null> {
    const analytics = await this.getByMonth(month);
    return analytics?.byEmployee || null;
  },

  /**
   * Get analytics breakdown by package
   */
  async getByPackage(month: string): Promise<Record<string, AnalyticsBreakdown> | null> {
    const analytics = await this.getByMonth(month);
    return analytics?.byPackage || null;
  },

  /**
   * Get analytics breakdown by country
   */
  async getByCountry(month: string): Promise<Record<string, AnalyticsBreakdown> | null> {
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
    const merged: Record<string, AnalyticsBreakdown> = {};
    analytics.forEach((a) => {
      if (a.byEmployee) {
        Object.entries(a.byEmployee).forEach(([employeeId, data]) => {
          if (!merged[employeeId]) {
            merged[employeeId] = { ...data };
          } else {
            merged[employeeId].totalPaymentsUSD += (data as AnalyticsBreakdown).totalPaymentsUSD;
            merged[employeeId].totalRefundsUSD += (data as AnalyticsBreakdown).totalRefundsUSD;
            merged[employeeId].netRevenueUSD += (data as AnalyticsBreakdown).netRevenueUSD;
            merged[employeeId].paymentCount += (data as AnalyticsBreakdown).paymentCount;
            merged[employeeId].refundCount += (data as AnalyticsBreakdown).refundCount;
          }
        });
      }
    });

    // Sort by net revenue and return top N
    return Object.entries(merged)
      .sort(
        (a, b) => (b[1] as AnalyticsBreakdown).netRevenueUSD - (a[1] as AnalyticsBreakdown).netRevenueUSD
      )
      .slice(0, limit);
  },
};
