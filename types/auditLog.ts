import type { Timestamp } from "firebase/firestore";

export type AuditCategory = "subscriber" | "financial" | "user" | "auth" | "system" | "whatsapp";
export type AuditSeverity = "info" | "success" | "warning" | "critical";
export type AuditSource = "dashboard" | "system" | "api";

export interface AuditPerformedBy {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export interface AuditTargetUser {
  uid?: string;
  name?: string;
  role?: string;
}

export interface AuditFinancialData {
  amount?: number;
  currency?: string;
  amountUSD?: number;
  impactType?: "positive" | "negative" | "neutral";
}

export interface AuditLog {
  id: string;
  action: string;
  category?: AuditCategory;

  entityType?: string;
  entityId?: string;
  entityName?: string;

  description?: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  changedFields?: string[];

  performedBy?: AuditPerformedBy;
  targetUser?: AuditTargetUser;
  financialData?: AuditFinancialData;

  metadata?: Record<string, unknown>;

  tags?: string[];
  severity?: AuditSeverity;
  status?: "completed" | "failed" | "pending";
  source?: AuditSource;

  // Legacy compat fields — present on older Firestore docs
  actorUid?: string;
  actorName?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  summary?: string;
  createdAt?: Timestamp;
}

export interface AuditLogFilters {
  action?: string;
  category?: AuditCategory | "";
  severity?: AuditSeverity | "";
  source?: AuditSource | "";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// Fully normalized view of any log (new or legacy schema)
export interface NormalizedAuditLog extends AuditLog {
  _performedByName: string;
  _performedByRole: string;
  _entityName: string;
  _description: string;
  _createdAt: Timestamp | null;
}
