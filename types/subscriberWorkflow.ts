import { Timestamp } from "firebase/firestore";
import type { WorkflowStatus, AssignmentType, NoteType, RenewalWorkflowStatus } from "@/constants/subscriberWorkflow";

// ─── Subscriber Note ──────────────────────────────────────────────────────────

export interface SubscriberNote {
  id: string;
  subscriberId: string;
  subscriberName?: string;
  authorId: string;
  authorName: string;
  content: string;
  noteType: NoteType;
  deleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Assignment history entry ─────────────────────────────────────────────────

export interface AssignmentHistoryEntry {
  assignedSalesId?:          string | null;
  assignedSalesName?:        string | null;
  assignedNutritionistId?:   string | null;
  assignedNutritionistName?: string | null;
  assignedTeamId?:           string | null;
  assignedTeamName?:         string | null;
  assignmentType:            AssignmentType;
  actorId:                   string;
  actorName:                 string;
  reason?:                   string;
  timestamp:                 Timestamp;
}

// ─── Subscriber workflow fields (additive extension to Subscriber) ────────────

export interface SubscriberWorkflowFields {
  // Assignment
  assignedSalesId?:          string | null;
  assignedSalesName?:        string | null;
  assignedNutritionistId?:   string | null;
  assignedNutritionistName?: string | null;
  assignedTeamId?:           string | null;
  assignedTeamName?:         string | null;
  assignmentType?:           AssignmentType;
  assignmentHistory?:        AssignmentHistoryEntry[];

  // Workflow status
  workflowStatus?:           WorkflowStatus;
  workflowStatusChangedAt?:  Timestamp;
  workflowStatusChangedBy?:  string;
  workflowStatusNote?:       string;

  // Renewal workflow
  renewalWorkflowStatus?:    RenewalWorkflowStatus;
  renewalSuggestedBy?:       string | null;
  renewalSuggestedByName?:   string | null;
  renewalHandledBy?:         string | null;
  renewalHandledByName?:     string | null;
  renewalNote?:              string;
}
