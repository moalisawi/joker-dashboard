// Schemas
export {
  createEmployeeSchema,
  updateEmployeeSchema,
  deactivateEmployeeSchema,
  granularPermissionsSchema,
  createTeamSchema,
} from "./schemas";

export type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DeactivateEmployeeInput,
  GranularPermissionsInput,
  CreateTeamInput,
} from "./schemas";

// Domain service
export { usersFeatureService } from "./services/users.service";

// React Query hooks
export {
  employeeKeys,
  useEmployeeList,
  useActiveEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useAssignTeam,
  useDeactivateEmployee,
  useUpdatePermissions,
} from "./hooks";
