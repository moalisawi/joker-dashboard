import { Timestamp } from "firebase/firestore";

/**
 * Freeze data stored within subscriber document
 * Preserves subscription days when temporarily paused
 */
export interface FreezeData {
  // Freeze status
  isFrozen: boolean;
  frozenAt: Timestamp | null;
  frozenBy: string | null;
  freezeReason?: string;
  freezeNotes?: string;

  // Preservation
  originalExpiryDate: string | null;
  remainingDays: number;

  // Resume history
  resumedAt: Timestamp | null;
  resumedBy: string | null;
}

/**
 * Freeze operation request
 */
export interface FreezeFreezeRequest {
  subscriberId: string;
  reason?: string;
  notes?: string;
  freezedBy: string;
  frozenByName: string;
}

/**
 * Resume operation request
 */
export interface FreezeResumeRequest {
  subscriberId: string;
  resumedBy: string;
  resumedByName: string;
}

/**
 * Freeze audit event
 */
export interface FreezeAuditEvent {
  action: "subscriber_frozen" | "subscriber_resumed";
  subscriberId: string;
  subscriberName: string;
  performedBy: string;
  performedByName: string;
  data: {
    frozenAt?: Timestamp;
    resumedAt?: Timestamp;
    remainingDays?: number;
    reason?: string;
    newExpiryDate?: string;
  };
  timestamp: Timestamp;
}
