"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersFeatureService } from "@/features/users/services/users.service";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DeactivateEmployeeInput,
  ReactivateEmployeeInput,
  ArchiveEmployeeInput,
  TransferDataInput,
  GranularPermissionsInput,
} from "@/features/users/schemas";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const employeeKeys = {
  all:       ["employees"]           as const,
  active:    ["employees", "active"] as const,
  directory: ["users", "directory"]  as const,
  detail: (uid: string) => ["employees", uid] as const,
  impact: (uid: string) => ["employees", uid, "impact"] as const,
};

/**
 * Everything the lifecycle touches, invalidated together.
 *
 * A single mutation moves an account between the directory list, the employee
 * lists and its own detail row, and forgetting one of them is how the console
 * used to show a person as still active on the page you just disabled them
 * from.
 */
function invalidateUserQueries(qc: ReturnType<typeof useQueryClient>, uid?: string) {
  qc.invalidateQueries({ queryKey: employeeKeys.all });
  qc.invalidateQueries({ queryKey: employeeKeys.active });
  qc.invalidateQueries({ queryKey: employeeKeys.directory });
  if (uid) {
    qc.invalidateQueries({ queryKey: employeeKeys.detail(uid) });
    qc.invalidateQueries({ queryKey: employeeKeys.impact(uid) });
  }
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

/** All employees (active + inactive). */
export function useEmployeeList() {
  return useQuery({
    queryKey: employeeKeys.all,
    queryFn:  () => usersFeatureService.getEmployees(),
    staleTime: 30_000,
  });
}

/** The whole directory — every account, including non-employees and archives. */
export function useUserDirectory(enabled = true) {
  return useQuery({
    queryKey: employeeKeys.directory,
    queryFn:  () => usersFeatureService.getAllUsers(),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * What is still attached to an account.
 *
 * Fetched on demand — the confirmation dialogs pass `enabled` only once they
 * open, so browsing the list does not run four count queries per row.
 */
export function useUserImpact(uid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: employeeKeys.impact(uid ?? ""),
    queryFn:  () => usersFeatureService.getImpact(uid!),
    enabled:  Boolean(uid) && enabled,
    staleTime: 15_000,
    retry: false,
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
    onSuccess: (_data, { uid }) => invalidateUserQueries(qc, uid),
  });
}

/** Restore access to a disabled, suspended, pending or archived account. */
export function useReactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReactivateEmployeeInput) =>
      usersFeatureService.reactivateEmployee(input),
    onSuccess: (_data, { uid }) => invalidateUserQueries(qc, uid),
  });
}

/** Archive an employee — owner-only, reversible, never a hard delete. */
export function useArchiveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ArchiveEmployeeInput) =>
      usersFeatureService.archiveEmployee(input),
    onSuccess: (_data, { uid }) => invalidateUserQueries(qc, uid),
  });
}

/** Hand assigned subscribers and leads from one employee to another. */
export function useTransferData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferDataInput) => usersFeatureService.transferData(input),
    onSuccess: (_data, { fromUid, toUid }) => {
      invalidateUserQueries(qc, fromUid);
      qc.invalidateQueries({ queryKey: employeeKeys.impact(toUid) });
      qc.invalidateQueries({ queryKey: ["subscribers"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-leads"] });
    },
  });
}

/** Update granular permissions for an employee (owner-only). */
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, permissions }: { uid: string; permissions: GranularPermissionsInput }) =>
      usersFeatureService.updatePermissions(uid, permissions),
    onSuccess: (_data, { uid }) => invalidateUserQueries(qc, uid),
  });
}
