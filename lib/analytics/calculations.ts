/**
 * Analytics Calculations
 *
 * Pure functions — no side effects, no Firebase imports.
 * All inputs are plain arrays/objects derived from existing hooks.
 */

import type { Subscriber } from "@/types";
import type { Payment }    from "@/types";
import type { Team }       from "@/types";

// ─── Revenue ──────────────────────────────────────────────────────────────────

/** Sum amountUSD for a set of payments */
export function totalNetRevenue(payments: Payment[]): number {
  return payments.reduce((s, p) => s + (p.amountUSD ?? 0), 0);
}

/** Alias — payments use amountUSD as the collected amount */
export function totalCollected(payments: Payment[]): number {
  return payments.reduce((s, p) => s + (p.amountUSD ?? 0), 0);
}

/** Sum remainingAmountUSD across active subscribers */
export function totalPendingInstallments(subscribers: Subscriber[]): number {
  return subscribers
    .filter((s) => s.subscriptionState === "active")
    .reduce((sum, s) => sum + (s.remainingAmountUSD ?? 0), 0);
}

/** Month-over-month revenue growth rate (as decimal). Returns null if no prior data. */
export function revenueGrowthRate(
  currentRevenue: number,
  priorRevenue: number
): number | null {
  if (priorRevenue === 0) return null;
  return (currentRevenue - priorRevenue) / priorRevenue;
}

/** MRR: sum of current month's net revenue */
export function calculateMRR(payments: Payment[], yearMonth: string): number {
  return payments
    .filter((p) => (p.date ?? "").startsWith(yearMonth))
    .reduce((s, p) => s + (p.amountUSD ?? 0), 0);
}

/** Revenue grouped by YYYY-MM, returns last `months` months */
export function revenueByMonth(
  payments: Payment[],
  months = 12
): { month: string; revenue: number; count: number }[] {
  const map = new Map<string, { revenue: number; count: number }>();

  for (const p of payments) {
    const d = toDateStr(p.createdAt).slice(0, 7);
    if (!d) continue;
    const prev = map.get(d) ?? { revenue: 0, count: 0 };
    map.set(d, { revenue: prev.revenue + (p.amountUSD ?? 0), count: prev.count + 1 });
  }

  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.slice(-months).map(([month, v]) => ({ month, ...v }));
}

// ─── Subscriber metrics ───────────────────────────────────────────────────────

/** Count subscribers expiring within `days` from today */
export function renewalsDue(subscribers: Subscriber[], days = 7): Subscriber[] {
  const now   = new Date();
  const limit = new Date(now.getTime() + days * 86400_000);
  return subscribers.filter((s) => {
    if (s.subscriptionState !== "active") return false;
    const exp = new Date(s.expiryDate);
    return exp >= now && exp <= limit;
  });
}

/** Completion rate: paid / (paid + remaining) across active subscribers */
export function installmentCompletionRate(subscribers: Subscriber[]): number {
  const active = subscribers.filter((s) => s.subscriptionState === "active");
  const paid   = active.reduce((s, sub) => s + (sub.paidAmountUSD ?? 0), 0);
  const total  = active.reduce((s, sub) => s + (sub.totalPriceUSD ?? 0), 0);
  return total === 0 ? 1 : paid / total;
}

/** Average lifetime value across all subscribers */
export function averageCustomerValue(subscribers: Subscriber[]): number {
  if (!subscribers.length) return 0;
  const total = subscribers.reduce((s, sub) => s + (sub.lifetimeValueUSD ?? sub.netAmountUSD ?? 0), 0);
  return total / subscribers.length;
}

/** Package breakdown: count + revenue per package type */
export function packageBreakdown(
  subscribers: Subscriber[]
): Record<string, { count: number; revenue: number }> {
  const map: Record<string, { count: number; revenue: number }> = {};
  for (const s of subscribers) {
    const pkg = s.package ?? "غير محدد";
    if (!map[pkg]) map[pkg] = { count: 0, revenue: 0 };
    map[pkg].count++;
    map[pkg].revenue += s.netAmountUSD ?? 0;
  }
  return map;
}

/** Retention rate: active / total non-withdrawn subscribers */
export function retentionRate(subscribers: Subscriber[]): number {
  const nonWithdrawn = subscribers.filter((s) => s.subscriptionState !== "withdrawn");
  if (!nonWithdrawn.length) return 0;
  const active = nonWithdrawn.filter(
    (s) => s.subscriptionStatus !== "expired" && s.subscriptionState === "active"
  );
  return active.length / nonWithdrawn.length;
}

// ─── Employee performance ─────────────────────────────────────────────────────

export interface EmployeeMetrics {
  name:        string;
  uid?:        string;
  subscribers: number;
  revenue:     number;
  active:      number;
  renewals:    number;
  refunds:     number;
  avgValue:    number;
}

/** Build per-employee metrics from subscriber data (matched by convincedBy name) */
export function employeePerformanceFromSubscribers(
  subscribers: Subscriber[]
): EmployeeMetrics[] {
  const map = new Map<string, EmployeeMetrics>();

  for (const s of subscribers) {
    const name = s.convincedBy || "غير محدد";
    if (!map.has(name)) {
      map.set(name, { name, subscribers: 0, revenue: 0, active: 0, renewals: 0, refunds: 0, avgValue: 0 });
    }
    const m = map.get(name)!;
    m.subscribers++;
    m.revenue += s.netAmountUSD ?? 0;
    if (s.subscriptionState === "active") m.active++;
    m.renewals += s.renewalCount ?? 0;
    m.refunds  += (s.refundAmountUSD ?? 0) > 0 ? 1 : 0;
  }

  const result = [...map.values()].filter((m) => m.name !== "غير محدد");
  result.forEach((m) => { m.avgValue = m.subscribers > 0 ? m.revenue / m.subscribers : 0; });
  return result.sort((a, b) => b.revenue - a.revenue);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString();
  if (raw instanceof Date) return raw.toISOString();
  return "";
}

/** Current YYYY-MM */
export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function toDateString(date: unknown): string {
  if (!date) return "";
  if (typeof date === "string") return date;
  if (typeof (date as { toDate?: () => Date }).toDate === "function")
    return (date as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date);
}

/** Payments that fall in the current calendar month */
export function paymentsThisMonth(payments: Payment[]): Payment[] {
  const ym = currentYearMonth();
  return payments.filter((p) => toDateString(p.date).startsWith(ym));
}

/** Payments created today */
export function paymentsToday(payments: Payment[]): Payment[] {
  const today = new Date().toISOString().slice(0, 10);
  return payments.filter((p) => toDateString(p.date).startsWith(today));
}

// ─── Sales analytics ──────────────────────────────────────────────────────────

export interface MonthlyAcquisition {
  month:       string; // YYYY-MM
  subscribers: number;
  revenue:     number;
}

/**
 * Buckets subscribers by the month they joined (s.date) for the last `months`.
 * Revenue = paidAmountUSD at time of joining (initial payment proxy).
 */
export function monthlyAcquisitionTrend(
  subscribers: Subscriber[],
  months = 6
): MonthlyAcquisition[] {
  const map = new Map<string, MonthlyAcquisition>();

  // Build last N month slots so we always show a full series (zeros included)
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    map.set(ym, { month: ym, subscribers: 0, revenue: 0 });
  }

  for (const s of subscribers) {
    const ym = toDateStr(s.date).slice(0, 7);
    if (!ym || !map.has(ym)) continue;
    const slot = map.get(ym)!;
    slot.subscribers++;
    slot.revenue += s.paidAmountUSD ?? 0;
  }

  return [...map.values()];
}

// ─── Team performance ─────────────────────────────────────────────────────────

export interface TeamMetrics {
  teamId:      string;
  teamName:    string;
  subscribers: number;
  active:      number;
  renewals:    number;
  revenue:     number;
  retentionRate: number;
  avgValue:    number;
}

/**
 * Build per-team metrics from subscriber data matched by assignedTeamId.
 * Teams with zero subscribers are included if passed in.
 */
export function teamPerformanceFromSubscribers(
  subscribers: Subscriber[],
  teams: Team[]
): TeamMetrics[] {
  const map = new Map<string, TeamMetrics>();

  for (const t of teams) {
    map.set(t.id, {
      teamId:        t.id,
      teamName:      t.name,
      subscribers:   0,
      active:        0,
      renewals:      0,
      revenue:       0,
      retentionRate: 0,
      avgValue:      0,
    });
  }

  for (const s of subscribers) {
    const tid = s.assignedTeamId;
    if (!tid) continue;
    if (!map.has(tid)) {
      map.set(tid, {
        teamId:        tid,
        teamName:      s.assignedTeamName ?? tid,
        subscribers:   0,
        active:        0,
        renewals:      0,
        revenue:       0,
        retentionRate: 0,
        avgValue:      0,
      });
    }
    const m = map.get(tid)!;
    m.subscribers++;
    m.revenue  += s.netAmountUSD ?? 0;
    m.renewals += s.renewalCount ?? 0;
    if (s.subscriptionState === "active") m.active++;
  }

  const result = [...map.values()];
  result.forEach((m) => {
    m.avgValue      = m.subscribers > 0 ? m.revenue / m.subscribers : 0;
    m.retentionRate = m.subscribers > 0 ? m.active / m.subscribers : 0;
  });
  return result.sort((a, b) => b.active - a.active);
}

// ─── Leaderboard helpers ──────────────────────────────────────────────────────

export type LeaderboardPeriod = "this_month" | "last_month" | "last_3months" | "all_time";

/** Filter subscribers whose join date falls within the given period */
export function filterByPeriod<T extends { date: string }>(
  items: T[],
  period: LeaderboardPeriod
): T[] {
  if (period === "all_time") return items;
  const now   = new Date();
  let from: Date;
  if (period === "this_month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "last_month") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return items.filter((i) => {
      const d = new Date(toDateStr(i.date).slice(0, 10));
      return d >= from && d <= to;
    });
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  }
  return items.filter((i) => new Date(toDateStr(i.date).slice(0, 10)) >= from);
}
