"use client";

import { useMemo, useState } from "react";
import { useSubscribersQuery } from "@/features/subscribers";
import { useActiveEmployees }  from "@/features/users/hooks";
import { useTeams }            from "@/hooks/useTeams";
import {
  buildLeaderboards,
  type LeaderboardData,
  type LeaderboardPeriod,
} from "@/features/leaderboards/lib/leaderboardMetrics";

export function useLeaderboards(): {
  data:      LeaderboardData | null;
  period:    LeaderboardPeriod;
  setPeriod: (p: LeaderboardPeriod) => void;
  isLoading: boolean;
} {
  const [period, setPeriod] = useState<LeaderboardPeriod>("this_month");

  const { data: subscribers = [], isLoading: subLoad } = useSubscribersQuery();
  const { data: employees   = [], isLoading: empLoad } = useActiveEmployees();
  const { data: teams       = [], isLoading: teamLoad} = useTeams(false);

  const data = useMemo(() => {
    if (subLoad || empLoad || teamLoad) return null;
    return buildLeaderboards(subscribers, employees, teams, period);
  }, [subscribers, employees, teams, period, subLoad, empLoad, teamLoad]);

  return {
    data,
    period,
    setPeriod,
    isLoading: subLoad || empLoad || teamLoad,
  };
}
