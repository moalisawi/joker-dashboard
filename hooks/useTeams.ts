"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamsService } from "@/services/teams.service";
import { useAuthStore } from "@/store/authStore";
import type { CreateTeamInput } from "@/features/users/schemas";

export const teamKeys = {
  all:    ["teams"]          as const,
  active: ["teams", "active"] as const,
  detail: (id: string) => ["teams", id] as const,
};

export function useTeams(activeOnly = false) {
  return useQuery({
    queryKey: activeOnly ? teamKeys.active : teamKeys.all,
    queryFn:  activeOnly
      ? () => teamsService.getActive()
      : () => teamsService.getAll(),
    staleTime: 60_000,
  });
}

export function useCreateTeam() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (input: CreateTeamInput) =>
      teamsService.create({ ...input, createdBy: user?.uid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: teamKeys.active });
    },
  });
}

export function useDeactivateTeam() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (id: string) => teamsService.deactivate(id, user?.uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: teamKeys.active });
    },
  });
}
