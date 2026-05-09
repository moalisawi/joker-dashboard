/**
 * Backward-compatible audit log helpers.
 * All new code should use auditService from services/audit.service.ts directly.
 * This file delegates to auditService so all logs share the same rich schema.
 */
import type { UserProfile } from "@/types";
import { auditService } from "@/services/audit.service";

export const AUDIT_ACTIONS = {
  // Legacy actions
  SUBSCRIBER_CREATED:   "subscriber_created",
  SUBSCRIBER_UPDATED:   "subscriber_updated",
  SUBSCRIBER_DELETED:   "subscriber_deleted",
  SUBSCRIBER_WITHDRAWN: "subscriber_withdrawn",
  PAYMENT_ADDED:        "payment_added",

  // Transaction-based actions
  PAYMENT_TRANSACTION_CREATED: "payment_transaction_created",
  SUBSCRIBER_REFUND_CREATED:   "subscriber_refund_created",
  ANALYTICS_RECALCULATED:      "analytics_recalculated",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export interface AuditLogEntry {
  action: AuditAction;
  actorUid: string;
  actorName: string;
  actorRole: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
}

export async function writeAuditLog(
  actor: UserProfile,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  return auditService.writeLog({
    actor,
    action,
    entityType:  details.targetType  as string | undefined,
    entityId:    details.targetId    as string | undefined,
    entityName:  details.targetName  as string | undefined,
    description: details.summary     as string | undefined,
    metadata:    details.metadata    as Record<string, unknown> | undefined ?? details,
  });
}

export async function logPaymentTransactionCreated(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  amountUSD: number,
  currency: string,
  paymentMethod: string
): Promise<void> {
  return auditService.logPaymentCreated(
    actor, subscriberId, subscriberName,
    amountUSD, currency, amountUSD, paymentMethod
  );
}

export async function logRefundTransactionCreated(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  refundAmountUSD: number,
  refundReason: string
): Promise<void> {
  return auditService.logRefundCreated(
    actor, subscriberId, subscriberName,
    refundAmountUSD, "USD", refundAmountUSD, refundReason
  );
}

export async function logAnalyticsRecalculated(
  actor: UserProfile,
  month: string,
  stats: Record<string, unknown>
): Promise<void> {
  return auditService.writeLog({
    actor,
    action: "analytics_recalculated",
    entityType: "analytics",
    entityId: month,
    description: `إعادة احتساب التحليلات للشهر ${month}`,
    metadata: { month, ...stats },
  });
}
