// ─── Email send result ────────────────────────────────────────────────────────

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Base send payload ────────────────────────────────────────────────────────

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

// ─── Email type discriminator ─────────────────────────────────────────────────

export type EmailType =
  | "subscription_expiring"
  | "renewal_success"
  | "refund_created"
  | "withdrawal_notice"
  | "freeze_notification"
  | "security_alert"
  | "failed_login"
  | "account_suspended";

// ─── Template data interfaces ─────────────────────────────────────────────────

export interface SubscriptionExpiringData {
  subscriberName: string;
  expiryDate: string;
  daysLeft: number;
  planName?: string;
  dashboardUrl?: string;
}

export interface RenewalSuccessData {
  subscriberName: string;
  renewalDate: string;
  newExpiryDate: string;
  amount: number;
  currency: string;
  amountUSD?: number;
  processedBy?: string;
  dashboardUrl?: string;
}

export interface RefundCreatedData {
  subscriberName: string;
  amount: number;
  currency: string;
  amountUSD?: number;
  reason?: string;
  createdBy: string;
  refundDate: string;
  dashboardUrl?: string;
}

export interface WithdrawalNoticeData {
  subscriberName: string;
  withdrawalDate: string;
  reason?: string;
  processedBy?: string;
  dashboardUrl?: string;
}

export interface FreezeNotificationData {
  subscriberName: string;
  freezeStartDate: string;
  freezeEndDate?: string;
  reason?: string;
  processedBy?: string;
  dashboardUrl?: string;
}

export interface SecurityAlertData {
  alertType: string;
  description: string;
  detectedAt: string;
  severity: "warning" | "critical";
  affectedEntity?: string;
  ipAddress?: string;
  dashboardUrl?: string;
}

export interface FailedLoginData {
  count: number;
  targetEmail?: string;
  detectedAt: string;
  windowMinutes?: number;
  dashboardUrl?: string;
}

export interface AccountSuspendedData {
  userName: string;
  userEmail: string;
  userRole?: string;
  suspendedBy: string;
  reason?: string;
  suspendedAt: string;
  dashboardUrl?: string;
}

// ─── API request body ─────────────────────────────────────────────────────────

export interface SendEmailRequest {
  type: EmailType;
  to: string | string[];
  data:
    | SubscriptionExpiringData
    | RenewalSuccessData
    | RefundCreatedData
    | WithdrawalNoticeData
    | FreezeNotificationData
    | SecurityAlertData
    | FailedLoginData
    | AccountSuspendedData;
}
