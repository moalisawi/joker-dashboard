"use client";

import { useQuery } from "@tanstack/react-query";
import { teamsFeatureService } from "@/features/teams/services/teams.feature.service";
import { teamFeatureKeys }     from "@/features/teams/hooks/queryKeys";

export function useTeamDetail(teamId: string | undefined) {
  return useQuery({
    queryKey: teamFeatureKeys.detail(teamId ?? ""),
    queryFn:  () => teamsFeatureService.getTeamById(teamId!),
    enabled:  Boolean(teamId),
    staleTime: 60_000,
  });
}
