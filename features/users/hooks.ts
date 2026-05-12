"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersFeatureService } from "@/features/users/services/users.service";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DeactivateEmployeeInput,
  GranularPermissionsInput,
} from "@/features/users/schemas";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const employeeKeys = {
  all:    ["employees"]         as const,
  active: ["employees", "active"] as const,
  detail: (uid: string) => ["employees", uid] as const,
};

// ─── Read hooks ───────────────────────────────────────────────────────────────

/** All employees (active + inactive). */
export function useEmployeeList() {
  return useQuery({
    queryKey: employeeKeys.all,
    queryFn:  () => usersFeatureService.getEmployees(),
    staleTime: 30_000,
  });
}

/** Active employees only — use in subscriber assignment dropdowns. */
export function useActiveEmployees() {
  return useQuery({
    queryKey: employeeKeys.active,
    queryFn:  () => usersFeatureService.getActiveEmployees(),
    staleTime: 30_000,
  });
}

/** Single employee by UID. */
export function useEmployee(uid: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(uid ?? ""),
    queryFn:  () => usersFeatureService.getEmployeeById(uid!),
    enabled:  Boolean(uid),
    staleTime: 30_000,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

/** Create a new Firebase Auth + Firestore employee (owner-only). */
export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      usersFeatureService.createEmployee(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      qc.invalidateQueries({ queryKey: employeeKeys.active });
    },
  });
}

/** Update employee role / department / team / phone / notes. */
export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) =>
      usersFeatureService.updateEmployee(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      qc.invalidateQueries({ queryKey: employeeKeys.detail(variables.uid) });
    },
  });
}

/** Assign or remove a team from an employee. */
export function useAssignTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, teamId }: { uid: string; teamId: string | null }) =>
      usersFeatureService.assignTeam(uid, teamId),
    onSuccess: (_data, { uid }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      qc.invalidateQueries({ queryKey: employeeKeys.detail(uid) });
    },
  });
}

/** Deactivate an employee (soft — account preserved). */
export function useDeactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeactivateEmployeeInput) =>
      usersFeatureService.deactivateEmployee(input),
    onSuccess: (_data, { uid }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      qc.invalidateQueries({ queryKey: employeeKeys.active });
      qc.invalidateQueries({ queryKey: employeeKeys.detail(uid) });
    },
  });
}

/** Update granular permissions for an employee (owner-only). */
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, permissions }: { uid: string; permissions: GranularPermissionsInput }) =>
      usersFeatureService.updatePermissions(uid, permissions),
    onSuccess: (_data, { uid }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(uid) });
    },
  });
}
