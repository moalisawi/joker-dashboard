import type { Timestamp } from "firebase/firestore";

export type NotificationType =
  | "subscription_expiring"
  | "subscription_expired"
  | "renewal_created"
  | "subscription_frozen"
  | "subscription_resumed"
  | "withdrawal_created"
  | "refund_created"
  | "high_refund_activity"
  | "revenue_drop"
  | "unusual_refunds"
  | "login_failed"
  | "suspicious_activity"
  | "role_changed"
  | "account_suspended"
  | "account_disabled"
  | "permission_changed"
  | "user_created"
  | "user_disabled"
  | "account_activated"
  | (string & Record<never, never>);

export type NotificationCategory = "operational" | "financial" | "security" | "user" | "insight";
export type NotificationSeverity = "info" | "success" | "warning" | "critical";

/** Minimum role required to receive this notification */
export type NotificationMinRole = "employee" | "admin" | "owner";

export interface NotificationPerformedBy {
  uid: string;
  name: string;
  role: string;
}

export interface NotificationFinancialData {
  amount?: number;
  currency?: string;
  amountUSD?: number;
}

export interface AppNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  description: string;
  severity: NotificationSeverity;

  /** UIDs of users who have marked this as read */
  readBy: string[];

  archived: boolean;

  actionUrl?: string;

  entityType?: string;
  entityId?: string;
  entityName?: string;

  performedBy?: NotificationPerformedBy;
  financialData?: NotificationFinancialData;

  metadata?: Record<string, unknown>;

  /** Minimum role level that should receive this notification */
  targetMinRole: NotificationMinRole;

  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface NotificationFilters {
  unread?: boolean;
  category?: NotificationCategory | "";
  severity?: NotificationSeverity | "";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
