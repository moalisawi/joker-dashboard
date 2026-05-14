import type { BaseDocument } from "./base";

export type TeamType = "sales" | "nutrition";

export interface Team extends BaseDocument {
  name: string;
  type: TeamType;

  /** Operational toggle — false means team is paused, not deleted */
  active: boolean;

  /** Pre-computed member count. Updated transactionally on every assign/remove. */
  membersCount: number;

  /** UID of the employee designated as team leader (must have employeeRole: "team_leader") */
  leaderId: string | null;

  /** Optional human-readable description */
  description: string | null;
}
