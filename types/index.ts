/**
 * Types Index
 * Centralized type exports organized by domain
 */

// Subscriber types
export type { Subscriber, RenewalSnapshot, SubscriptionState, SubscriptionStatus, SubscriberStatus, PackageType, Currency } from "./subscriber";

// Freeze types
export type { FreezeData, FreezeFreezeRequest, FreezeResumeRequest, FreezeAuditEvent } from "./freeze";

// Withdrawal types
export type { WithdrawalData, WithdrawalRequest } from "./withdrawal";

// Payment types
export type { Payment, PaymentTransaction, PaymentType } from "./payment";

// Refund types
export type { RefundTransaction } from "./refund";

// User types
export type { UserProfile, Role, Permissions } from "./user";

// Permission types
export type { AccountStatus, GranularPermissions } from "./permissions";
export { PERMISSION_LABELS } from "./permissions";

// Analytics types
export type { MonthlyAnalytics } from "./analytics";

// Common types
export type { AuditLog, PhoneCountry, ExchangeRates } from "./common";

// Audit log types (extended schema)
export type {
  AuditCategory,
  AuditSeverity,
  AuditSource,
  AuditPerformedBy,
  AuditTargetUser,
  AuditFinancialData,
  AuditLogFilters,
  NormalizedAuditLog,
} from "./auditLog";

// Notification types
export type {
  NotificationType,
  NotificationCategory,
  NotificationSeverity,
  NotificationMinRole,
  NotificationPerformedBy,
  NotificationFinancialData,
  AppNotification,
  NotificationFilters,
} from "./notification";

// Employee types
export type { EmployeeRole, EmployeeDepartment } from "./employee";

// Team types
export type { Team, TeamType } from "./team";

// Subscriber workflow types (Phase 3)
export type { SubscriberNote, AssignmentHistoryEntry, SubscriberWorkflowFields } from "./subscriberWorkflow";

// Email types
export type {
  EmailResult,
  EmailType,
  SendEmailPayload,
  SendEmailRequest,
  SubscriptionExpiringData,
  RenewalSuccessData,
  RefundCreatedData,
  WithdrawalNoticeData,
  FreezeNotificationData,
  SecurityAlertData,
  FailedLoginData,
  AccountSuspendedData,
} from "./email";
