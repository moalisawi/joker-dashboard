import type { Timestamp } from "firebase/firestore";

/**
 * Shared base fields for every Firestore document in this system.
 * Extend this in domain-specific interfaces.
 */
export interface BaseDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
  /** Soft-delete flag. True means logically deleted — do not show in UI. */
  deleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}
