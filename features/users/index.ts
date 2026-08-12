// Schemas
export {
  createEmployeeSchema,
  updateEmployeeSchema,
  deactivateEmployeeSchema,
  reactivateEmployeeSchema,
  archiveEmployeeSchema,
  transferDataSchema,
  granularPermissionsSchema,
  createTeamSchema,
} from "./schemas";

export type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DeactivateEmployeeInput,
  ReactivateEmployeeInput,
  ArchiveEmployeeInput,
  TransferDataInput,
  GranularPermissionsInput,
  CreateTeamInput,
} from "./schemas";

// Domain service
export { usersFeatureService } from "./services/users.service";

// React Query hooks
export {
  employeeKeys,
  useEmployeeList,
  useUserDirectory,
  useUserImpact,
  useActiveEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useAssignTeam,
  useDeactivateEmployee,
  useReactivateEmployee,
  useArchiveEmployee,
  useTransferData,
  useUpdatePermissions,
} from "./hooks";
