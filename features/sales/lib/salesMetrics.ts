/**
 * Sales-specific pure calculation helpers.
 * All inputs come from existing React Query caches — no Firestore reads here.
 */

import type { Subscriber } from "@/types";
import type { UserProfile } from "@/types";
import {
  monthlyAcquisitionTrend,
  type EmployeeMetrics,
  type MonthlyAcquisition,
} from "@/lib/analytics/calculations";

export interface SalesEmployeeMetrics extends EmployeeMetrics {
  uid:            string;
  name:           string;
  email:          string;
  conversionRate: number; // active / total
  initialRevenue: number; // sum of paidAmountUSD for non-renewal subscribers
  renewalRevenue: number;
  trend:          MonthlyAcquisition[];
}

/**
 * Subscribers credited to one sales employee.
 *
 * Two fields carry that credit and only one of them is populated. `assignedSalesId`
 * belongs to the newer workflow extension and is set on NO subscriber in this
 * installation; `convincedByUid` is set on all of them. Matching only the former
 * meant every employee scored zero subscribers and $0 revenue, which is why the
 * sales page shows nothing and — presumably — why it was quietly dropped from the
 * navigation instead of being fixed.
 *
 * Both are honoured, newer first, mirroring the two-tier check useSubscribers
 * already makes. An explicit assignment wins when it exists; otherwise credit
 * goes to whoever signed the customer up.
 */
export function filterEmployeeSubscribers(
  subscribers: Subscriber[],
  employeeUid: string
): Subscriber[] {
  return subscribers.filter((s) =>
    s.assignedSalesId ? s.assignedSalesId === employeeUid : s.convincedByUid === employeeUid,
  );
}

/**
 * Build full SalesEmployeeMetrics for one employee.
 * Call with the full subscribers list — filtering happens internally.
 */
export function buildSalesMetrics(
  employee: UserProfile,
  allSubscribers: Subscriber[],
  months = 6
): SalesEmployeeMetrics {
  const subs = filterEmployeeSubscribers(allSubscribers, employee.uid);

  const active         = subs.filter((s) => s.subscriptionState === "active").length;
  const revenue        = subs.reduce((n, s) => n + (s.netAmountUSD ?? 0), 0);
  const initialRevenue = subs
    .filter((s) => !s.renewalCount || s.renewalCount === 0)
    .reduce((n, s) => n + (s.paidAmountUSD ?? 0), 0);
  const renewalRevenue = subs
    .filter((s) => (s.renewalCount ?? 0) > 0)
    .reduce((n, s) => n + (s.netAmountUSD ?? 0), 0);
  const renewals = subs.reduce((n, s) => n + (s.renewalCount ?? 0), 0);
  const refunds  = subs.filter((s) => (s.refundAmountUSD ?? 0) > 0).length;

  return {
    uid:            employee.uid,
    name:           employee.name,
    email:          employee.email,
    subscribers:    subs.length,
    active,
    revenue,
    initialRevenue,
    renewalRevenue,
    renewals,
    refunds,
    avgValue:       subs.length > 0 ? revenue / subs.length : 0,
    conversionRate: subs.length > 0 ? active / subs.length : 0,
    trend:          monthlyAcquisitionTrend(subs, months),
  };
}

/** Build metrics for ALL sales employees at once */
export function buildAllSalesMetrics(
  employees: UserProfile[],
  allSubscribers: Subscriber[]
): SalesEmployeeMetrics[] {
  const salesEmps = employees.filter((e) => e.employeeRole === "sales");
  return salesEmps
    .map((e) => buildSalesMetrics(e, allSubscribers))
    .sort((a, b) => b.revenue - a.revenue);
}
