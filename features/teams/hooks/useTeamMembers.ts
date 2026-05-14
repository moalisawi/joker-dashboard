"use client";

import { useQuery } from "@tanstack/react-query";
import { teamsFeatureService } from "@/features/teams/services/teams.feature.service";
import { teamFeatureKeys }     from "@/features/teams/hooks/queryKeys";

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: teamFeatureKeys.members(teamId ?? ""),
    queryFn:  () => teamsFeatureService.getMembersByTeamId(teamId!),
    enabled:  Boolean(teamId),
    staleTime: 30_000,
  });
}
