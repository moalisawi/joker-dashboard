/**
 * Leaderboard aggregation helpers.
 * Pure functions — all inputs from existing React Query caches.
 */

import type { Subscriber } from "@/types";
import type { Team }       from "@/types";
import type { UserProfile } from "@/types";
import {
  filterByPeriod,
  teamPerformanceFromSubscribers,
  type TeamMetrics,
  type LeaderboardPeriod,
} from "@/lib/analytics/calculations";
import {
  buildAllSalesMetrics,
  type SalesEmployeeMetrics,
} from "@/features/sales/lib/salesMetrics";

export type { LeaderboardPeriod };

export interface LeaderboardEntry {
  rank:        number;
  uid:         string;
  name:        string;
  value:       number;
  subValue?:   number;
  subLabel?:   string;
  badge?:      string;
}

export interface LeaderboardData {
  salesByRevenue:      LeaderboardEntry[];
  salesBySubscribers:  LeaderboardEntry[];
  salesByConversion:   LeaderboardEntry[];
  teamsByActive:       LeaderboardEntry[];
  teamsByRenewals:     LeaderboardEntry[];
  teamsByRetention:    LeaderboardEntry[];
}

function toSalesEntries(
  list: SalesEmployeeMetrics[],
  key: keyof SalesEmployeeMetrics,
  subKey?: keyof SalesEmployeeMetrics
): LeaderboardEntry[] {
  return [...list]
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .map((m, i) => ({
      rank:     i + 1,
      uid:      m.uid,
      name:     m.name,
      value:    m[key] as number,
      subValue: subKey ? (m[subKey] as number) : undefined,
    }));
}

function toTeamEntries(
  list: TeamMetrics[],
  key: keyof TeamMetrics
): LeaderboardEntry[] {
  return [...list]
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .map((m, i) => ({
      rank:  i + 1,
      uid:   m.teamId,
      name:  m.teamName,
      value: m[key] as number,
    }));
}

export function buildLeaderboards(
  allSubscribers: Subscriber[],
  employees:      UserProfile[],
  teams:          Team[],
  period:         LeaderboardPeriod
): LeaderboardData {
  // Filter subscribers by period before building metrics
  const periodSubs = filterByPeriod(allSubscribers, period);

  const salesMetrics = buildAllSalesMetrics(employees, periodSubs);
  const teamMetrics  = teamPerformanceFromSubscribers(periodSubs, teams);

  return {
    salesByRevenue:     toSalesEntries(salesMetrics, "revenue",        "subscribers"),
    salesBySubscribers: toSalesEntries(salesMetrics, "subscribers",    "active"),
    salesByConversion:  toSalesEntries(salesMetrics, "conversionRate", "subscribers"),
    teamsByActive:      toTeamEntries(teamMetrics,   "active"),
    teamsByRenewals:    toTeamEntries(teamMetrics,   "renewals"),
    teamsByRetention:   toTeamEntries(teamMetrics,   "retentionRate"),
  };
}

export const PERIOD_OPTIONS: { key: LeaderboardPeriod; label: string }[] = [
  { key:"this_month",   label:"هذا الشهر"  },
  { key:"last_month",   label:"الشهر الماضي" },
  { key:"last_3months", label:"آخر 3 أشهر" },
  { key:"all_time",     label:"كل الوقت"   },
];
