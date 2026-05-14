"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamsService }  from "@/services/teams.service";
import { useAuthStore }  from "@/store/authStore";
import type { CreateTeamInput } from "@/features/users/schemas";
import type { ActivityLogActor } from "@/types";

export const teamKeys = {
  all:    ["teams"]            as const,
  active: ["teams", "active"]  as const,
  detail: (id: string) => ["teams", id] as const,
};

// ─── queries ──────────────────────────────────────────────────────────────────

export function useTeams(activeOnly = false) {
  return useQuery({
    queryKey: activeOnly ? teamKeys.active : teamKeys.all,
    queryFn:  activeOnly
      ? () => teamsService.getActive()
      : () => teamsService.getAll(),
    staleTime: 60_000,
  });
}

// ─── mutations ────────────────────────────────────────────────────────────────

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

export function useActivateTeam() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (id: string) => teamsService.activate(id, user?.uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: teamKeys.active });
    },
  });
}

export function useUpdateTeam() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; active?: boolean; description?: string | null } }) =>
      teamsService.update(id, data, user?.uid),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: teamKeys.active });
      qc.invalidateQueries({ queryKey: teamKeys.detail(id) });
    },
  });
}

/**
 * Safe delete — nulls all member teamIds before soft-deleting.
 * Replaces the old useDeleteTeam (which only soft-deleted without cleanup).
 */
export function useDeleteTeam() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const actor: ActivityLogActor = { uid: user.uid, name: user.name ?? user.email, role: user.role };
      return teamsService.safeDelete(id, actor);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: teamKeys.active });
    },
  });
}

/**
 * Assign a team leader.
 * Pass the employee's uid + name; the service writes leaderId to the team doc
 * and logs the action to activityLogs.
 */
export function useAssignLeader() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({
      teamId,
      leaderId,
      leaderName,
    }: {
      teamId:     string;
      leaderId:   string;
      leaderName: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const actor: ActivityLogActor = { uid: user.uid, name: user.name ?? user.email, role: user.role };
      return teamsService.assignLeader(teamId, leaderId, leaderName, actor);
    },
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

export function useRemoveLeader() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (teamId: string) => {
      if (!user) throw new Error("Not authenticated");
      const actor: ActivityLogActor = { uid: user.uid, name: user.name ?? user.email, role: user.role };
      return teamsService.removeLeader(teamId, actor);
    },
    onSuccess: (_data, teamId) => {
      qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}
