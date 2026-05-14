import type { Timestamp } from "firebase/firestore";
import type { AssignmentType } from "@/constants/subscriberWorkflow";

/** Immutable history record stored in `subscriberAssignments` collection. */
export interface SubscriberAssignmentRecord {
  id?: string;

  subscriberId:   string;
  subscriberName: string;

  // From state
  fromTeamId?:        string | null;
  fromTeamName?:      string | null;
  fromEmployeeId?:    string | null;
  fromEmployeeName?:  string | null;
  fromAssignmentType?: AssignmentType;

  // To state
  toTeamId?:        string | null;
  toTeamName?:      string | null;
  toEmployeeId?:    string | null;
  toEmployeeName?:  string | null;
  toAssignmentType: AssignmentType;

  reason?:          string;
  transferredBy:    string;
  transferredByName:string;

  createdAt: Timestamp | string;
}
