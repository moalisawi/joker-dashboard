import type { Timestamp } from "firebase/firestore";

export type ActivityLogType =
  | "team_assigned"      // employee added to a team
  | "team_removed"       // employee removed from a team (unassigned)
  | "team_transferred"   // employee moved from one team to another
  | "team_deleted"       // entire team was soft-deleted
  | "leader_assigned"    // a team leader was set or changed
  | "leader_removed"     // team leader was cleared
  | "role_changed";      // employeeRole changed

export interface ActivityLogActor {
  uid: string;
  name: string;
  role: string;
}

export interface ActivityLog {
  id: string;
  type: ActivityLogType;
  performedBy: ActivityLogActor;

  /** The employee this action targets (undefined for team-level events like team_deleted) */
  employeeId?: string;
  employeeName?: string;

  /** Team context */
  teamId?: string;
  teamName?: string;

  /** Previous team — populated on team_transferred and team_removed */
  oldTeamId?: string | null;
  oldTeamName?: string | null;

  /** New team — populated on team_assigned and team_transferred */
  newTeamId?: string | null;
  newTeamName?: string | null;

  /** Previous role — populated on role_changed */
  oldRole?: string | null;
  /** New role — populated on role_changed */
  newRole?: string | null;

  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
