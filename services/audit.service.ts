import { auth } from "@/lib/auth";
import type { UserProfile } from "@/types";
import type {
  AuditCategory,
  AuditSeverity,
  AuditSource,
  AuditPerformedBy,
  AuditFinancialData,
} from "@/types";
import { notificationService } from "./notification.service";

// ─── severity map ────────────────────────────────────────────────────────────

const ACTION_SEVERITY: Record<string, AuditSeverity> = {
  subscriber_created:   "success",
  subscriber_updated:   "info",
  subscriber_renewed:   "success",
  subscriber_frozen:    "warning",
  subscriber_resumed:   "info",
  subscriber_withdrawn: "warning",
  subscriber_expired:   "warning",
  subscriber_deleted:   "critical",
  payment_created:      "success",
  payment_updated:      "info",
  refund_created:       "warning",
  refund_updated:       "warning",
  user_created:         "info",
  user_updated:         "info",
  role_changed:         "warning",
  permissions_changed:  "warning",
  account_activated:    "success",
  account_suspended:    "critical",
  account_disabled:     "critical",
  login_success:        "info",
  login_failed:         "critical",
  logout:               "info",
  analytics_exported:   "info",
  settings_updated:     "warning",
  data_imported:        "info",
  data_exported:        "info",
  // payment methods
  paymentMethod_created:        "success",
  paymentMethod_updated:        "info",
  paymentMethod_status_changed: "warning",
  paymentMethod_deleted:        "critical",
  // legacy
  payment_added:              "success",
  payment_transaction_created: "success",
  subscriber_refund_created:   "warning",
  analytics_recalculated:      "info",
  // whatsapp
  whatsapp_lead_created:                   "info",
  whatsapp_lead_status_changed:            "info",
  whatsapp_lead_assigned:                  "info",
  whatsapp_conversation_status_changed:    "info",
  whatsapp_internal_note_added:            "info",
  whatsapp_note_added:                     "info",
  whatsapp_note_removed:                   "warning",
  whatsapp_tags_updated:                   "info",
};

const ACTION_CATEGORY: Record<string, AuditCategory> = {
  subscriber_created:   "subscriber",
  subscriber_updated:   "subscriber",
  subscriber_renewed:   "subscriber",
  subscriber_frozen:    "subscriber",
  subscriber_resumed:   "subscriber",
  subscriber_withdrawn: "subscriber",
  subscriber_expired:   "subscriber",
  subscriber_deleted:   "subscriber",
  payment_created:      "financial",
  payment_updated:      "financial",
  refund_created:       "financial",
  refund_updated:       "financial",
  user_created:         "user",
  user_updated:         "user",
  role_changed:         "user",
  permissions_changed:  "user",
  account_activated:    "user",
  account_suspended:    "user",
  account_disabled:     "user",
  login_success:        "auth",
  login_failed:         "auth",
  logout:               "auth",
  analytics_exported:   "system",
  settings_updated:     "system",
  data_imported:        "system",
  data_exported:        "system",
  // payment methods
  paymentMethod_created:        "system",
  paymentMethod_updated:        "system",
  paymentMethod_status_changed: "system",
  paymentMethod_deleted:        "system",
  // legacy
  payment_added:              "financial",
  payment_transaction_created: "financial",
  subscriber_refund_created:   "financial",
  analytics_recalculated:      "system",
  // whatsapp
  whatsapp_lead_created:                   "whatsapp",
  whatsapp_lead_status_changed:            "whatsapp",
  whatsapp_lead_assigned:                  "whatsapp",
  whatsapp_conversation_status_changed:    "whatsapp",
  whatsapp_internal_note_added:            "whatsapp",
  whatsapp_note_added:                     "whatsapp",
  whatsapp_note_removed:                   "whatsapp",
  whatsapp_tags_updated:                   "whatsapp",
};

// ─── core writer ─────────────────────────────────────────────────────────────

interface WriteLogParams {
  actor: UserProfile | AuditPerformedBy;
  action: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  source?: AuditSource;

  entityType?: string;
  entityId?: string;
  entityName?: string;
  description?: string;

  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  changedFields?: string[];

  financialData?: AuditFinancialData;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

function toPerformedBy(actor: UserProfile | AuditPerformedBy): AuditPerformedBy {
  if ("uid" in actor && "email" in actor && "name" in actor) {
    return {
      uid:   actor.uid,
      name:  (actor as AuditPerformedBy).name ?? (actor as UserProfile).name ?? "",
      email: actor.email ?? "",
      role:  actor.role ?? "",
    };
  }
  const u = actor as UserProfile;
  return {
    uid:   u.uid,
    name:  u.name ?? u.email ?? "",
    email: u.email ?? "",
    role:  u.role ?? "",
  };
}

async function writeLog(params: WriteLogParams): Promise<void> {
  const {
    actor, action, source = "dashboard",
    entityType, entityId, entityName, description,
    previousData, newData, changedFields,
    financialData, metadata = {}, tags = [],
  } = params;

  const category  = params.category  ?? ACTION_CATEGORY[action]  ?? "system";
  const severity  = params.severity  ?? ACTION_SEVERITY[action]  ?? "info";
  const performer = toPerformedBy(actor);

  try {
    // Audit records are written server-side through /api/audit-log.
    //
    // firestore.rules sets `allow write: if false` on auditLogs so that a client
    // can never forge or alter an audit record. Writing with addDoc() from here
    // was therefore always rejected, and the rejection was swallowed by the
    // catch below — the trail recorded nothing. The route writes via the Admin
    // SDK and derives the actor identity from the verified ID token.
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch("/api/audit-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        category,
        severity,
        source,

        entityType,
        entityId,
        entityName,
        description,

        previousData:  previousData ?? null,
        newData:       newData      ?? null,
        changedFields: changedFields ?? [],

        performedBy: performer,
        financialData: financialData ?? null,
        metadata,
        tags,
      }),
    });

    if (!response.ok) {
      throw new Error(`audit-log responded ${response.status}`);
    }

    // Fire-and-forget: create a notification for notification-worthy actions
    notificationService.createFromAuditAction({
      action,
      entityType,
      entityId,
      entityName,
      description,
      performedBy: { ...performer },
      financialData: financialData
        ? {
            amount:    financialData.amount,
            currency:  financialData.currency,
            amountUSD: financialData.amountUSD,
            impactType: financialData.impactType,
          }
        : undefined,
      metadata,
    });
  } catch (err) {
    // Audit logging must never break the user-facing operation that triggered
    // it, so the error is contained here — but logged at error level so it is
    // picked up by monitoring rather than disappearing into a warning.
    console.error("[audit] log failed:", err);
  }
}

// ─── subscriber actions ───────────────────────────────────────────────────────

function logSubscriberCreated(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  details?: Record<string, unknown>
) {
  return writeLog({
    actor,
    action: "subscriber_created",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `تم إضافة مشترك جديد: ${subscriberName}`,
    newData: details,
    tags: ["subscriber"],
  });
}

function logSubscriberUpdated(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  previousData: Record<string, unknown>,
  newData: Record<string, unknown>,
  changedFields: string[]
) {
  return writeLog({
    actor,
    action: "subscriber_updated",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `تم تعديل بيانات: ${subscriberName}`,
    previousData,
    newData,
    changedFields,
    tags: ["subscriber"],
  });
}

function logSubscriberRenewed(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  amountUSD: number,
  currency: string,
  renewalNumber?: number
) {
  return writeLog({
    actor,
    action: "subscriber_renewed",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `تجديد اشتراك: ${subscriberName}`,
    financialData: { amountUSD, currency, impactType: "positive" },
    metadata: { renewalNumber },
    tags: ["subscriber", "financial"],
  });
}

function logSubscriberFrozen(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  reason: string,
  remainingDays: number,
  originalExpiryDate: string
) {
  return writeLog({
    actor,
    action: "subscriber_frozen",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `تم تجميد اشتراك: ${subscriberName} — السبب: ${reason}`,
    metadata: { reason, remainingDays, originalExpiryDate },
    tags: ["subscriber", "freeze"],
  });
}

function logSubscriberResumed(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  frozenDays: number,
  newExpiryDate: string
) {
  return writeLog({
    actor,
    action: "subscriber_resumed",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `تم استئناف اشتراك: ${subscriberName} | ينتهي ${newExpiryDate}`,
    metadata: { frozenDays, newExpiryDate },
    tags: ["subscriber", "freeze"],
  });
}

function logSubscriberWithdrawn(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  reason: string,
  refundData?: { amount: number; currency: string; amountUSD: number }
) {
  return writeLog({
    actor,
    action: "subscriber_withdrawn",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `انسحاب: ${subscriberName} — السبب: ${reason}`,
    financialData: refundData
      ? { amount: refundData.amount, currency: refundData.currency, amountUSD: refundData.amountUSD, impactType: "negative" }
      : undefined,
    metadata: { reason, hasRefund: !!refundData },
    tags: ["subscriber", "withdrawal"],
  });
}

function logSubscriberDeleted(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string
) {
  return writeLog({
    actor,
    action: "subscriber_deleted",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `تم حذف المشترك: ${subscriberName}`,
    tags: ["subscriber", "delete"],
  });
}

// ─── financial actions ────────────────────────────────────────────────────────

function logPaymentCreated(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  amount: number,
  currency: string,
  amountUSD: number,
  paymentMethod: string,
  isRenewal = false
) {
  return writeLog({
    actor,
    action: "payment_created",
    entityType: "payment",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `دفعة جديدة: ${subscriberName} — ${amount} ${currency} ($${amountUSD.toFixed(2)})`,
    financialData: { amount, currency, amountUSD, impactType: "positive" },
    metadata: { paymentMethod, isRenewal },
    tags: ["financial", "payment"],
  });
}

function logRefundCreated(
  actor: UserProfile,
  subscriberId: string,
  subscriberName: string,
  amount: number,
  currency: string,
  amountUSD: number,
  reason: string
) {
  return writeLog({
    actor,
    action: "refund_created",
    entityType: "refund",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `استرداد: ${subscriberName} — ${amount} ${currency} ($${amountUSD.toFixed(2)}) — ${reason}`,
    financialData: { amount, currency, amountUSD, impactType: "negative" },
    metadata: { reason },
    tags: ["financial", "refund"],
  });
}

// ─── user / account actions ───────────────────────────────────────────────────

function logUserCreated(
  actor: UserProfile,
  targetUid: string,
  targetName: string,
  targetRole: string
) {
  return writeLog({
    actor,
    action: "user_created",
    entityType: "user",
    entityId: targetUid,
    entityName: targetName,
    description: `تم إنشاء مستخدم جديد: ${targetName} (${targetRole})`,
    metadata: { targetRole },
    tags: ["user"],
  });
}

function logUserUpdated(
  actor: UserProfile,
  targetUid: string,
  targetName: string,
  previousData: Record<string, unknown>,
  newData: Record<string, unknown>,
  changedFields: string[]
) {
  return writeLog({
    actor,
    action: "user_updated",
    entityType: "user",
    entityId: targetUid,
    entityName: targetName,
    description: `تم تعديل بيانات المستخدم: ${targetName}`,
    previousData,
    newData,
    changedFields,
    tags: ["user"],
  });
}

function logRoleChanged(
  actor: UserProfile,
  targetUid: string,
  targetName: string,
  oldRole: string,
  newRole: string
) {
  return writeLog({
    actor,
    action: "role_changed",
    entityType: "user",
    entityId: targetUid,
    entityName: targetName,
    description: `تغيير دور: ${targetName} — ${oldRole} → ${newRole}`,
    previousData: { role: oldRole },
    newData: { role: newRole },
    changedFields: ["role"],
    tags: ["user", "permissions"],
  });
}

function logPermissionsChanged(
  actor: UserProfile,
  targetUid: string,
  targetName: string,
  previousPermissions: Record<string, unknown>,
  newPermissions: Record<string, unknown>
) {
  return writeLog({
    actor,
    action: "permissions_changed",
    entityType: "user",
    entityId: targetUid,
    entityName: targetName,
    description: `تعديل صلاحيات: ${targetName}`,
    previousData: previousPermissions,
    newData: newPermissions,
    changedFields: ["permissions"],
    tags: ["user", "permissions"],
  });
}

function logAccountStatusChanged(
  actor: UserProfile,
  targetUid: string,
  targetName: string,
  oldStatus: string,
  newStatus: string
) {
  const action =
    newStatus === "active"    ? "account_activated"  :
    newStatus === "suspended" ? "account_suspended"  :
    newStatus === "disabled"  ? "account_disabled"   : "user_updated";

  return writeLog({
    actor,
    action,
    entityType: "user",
    entityId: targetUid,
    entityName: targetName,
    description: `تغيير حالة حساب: ${targetName} — ${oldStatus} → ${newStatus}`,
    previousData: { status: oldStatus },
    newData: { status: newStatus },
    changedFields: ["status"],
    tags: ["user", "account"],
  });
}

// ─── auth actions ─────────────────────────────────────────────────────────────

function logLoginSuccess(
  uid: string,
  name: string,
  email: string,
  role: string
) {
  const fakeActor: AuditPerformedBy = { uid, name, email, role };
  return writeLog({
    actor: fakeActor,
    action: "login_success",
    entityType: "user",
    entityId: uid,
    entityName: name,
    description: `تسجيل دخول ناجح: ${name}`,
    tags: ["auth"],
  });
}

function logLoginFailed(email: string, reason?: string) {
  const fakeActor: AuditPerformedBy = { uid: "anonymous", name: "غير معروف", email, role: "unknown" };
  return writeLog({
    actor: fakeActor,
    action: "login_failed",
    entityType: "user",
    entityId: email,
    entityName: email,
    description: `فشل تسجيل الدخول: ${email}${reason ? ` — ${reason}` : ""}`,
    metadata: { reason },
    tags: ["auth", "security"],
  });
}

function logLogout(actor: UserProfile) {
  return writeLog({
    actor,
    action: "logout",
    entityType: "user",
    entityId: actor.uid,
    entityName: actor.name ?? actor.email ?? "",
    description: `تسجيل خروج: ${actor.name ?? actor.email ?? ""}`,
    tags: ["auth"],
  });
}

// ─── system actions ───────────────────────────────────────────────────────────

function logAnalyticsExported(actor: UserProfile, period: string, rowCount?: number) {
  return writeLog({
    actor,
    action: "analytics_exported",
    entityType: "analytics",
    entityId: period,
    description: `تصدير التحليلات: ${period}${rowCount != null ? ` (${rowCount} صف)` : ""}`,
    metadata: { period, rowCount },
    tags: ["system", "export"],
  });
}

function logDataExported(actor: UserProfile, dataType: string, rowCount?: number) {
  return writeLog({
    actor,
    action: "data_exported",
    entityType: dataType,
    description: `تصدير البيانات: ${dataType}${rowCount != null ? ` (${rowCount} صف)` : ""}`,
    metadata: { dataType, rowCount },
    tags: ["system", "export"],
  });
}

function logSettingsUpdated(
  actor: UserProfile,
  setting: string,
  previousValue: unknown,
  newValue: unknown
) {
  return writeLog({
    actor,
    action: "settings_updated",
    entityType: "settings",
    entityId: setting,
    description: `تعديل الإعدادات: ${setting}`,
    previousData: { [setting]: previousValue },
    newData: { [setting]: newValue },
    changedFields: [setting],
    tags: ["system"],
  });
}

// ─── unified track() interface ────────────────────────────────────────────────

interface TrackParams {
  /** The actor performing the action (UserProfile or AuditPerformedBy). */
  actor: UserProfile | AuditPerformedBy;
  /** Action key — must match one of the keys in ACTION_SEVERITY / ACTION_CATEGORY. */
  action: string;
  /** Entity type (e.g. "subscriber", "payment", "user"). */
  entity?: string;
  entityId?: string;
  entityName?: string;
  /** State before the mutation. */
  before?: Record<string, unknown>;
  /** State after the mutation. */
  after?: Record<string, unknown>;
  financialData?: AuditFinancialData;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Unified audit track method.
 *
 * Use this for all new audit calls. Provides a simpler surface than writeLog()
 * while preserving full Firestore compatibility.
 *
 * Example:
 *   await auditService.track({
 *     actor: user,
 *     action: "subscriber_renewed",
 *     entity: "subscriber",
 *     entityId: subscriber.id,
 *     entityName: subscriber.name,
 *     before: { expiryDate: oldExpiry },
 *     after:  { expiryDate: newExpiry },
 *     financialData: { amountUSD, currency, impactType: "positive" },
 *   });
 */
function track(params: TrackParams): Promise<void> {
  const { actor, action, entity, entityId, entityName, before, after, financialData, metadata, tags } = params;

  const changedFields = before && after
    ? Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    : undefined;

  return writeLog({
    actor,
    action,
    entityType:    entity,
    entityId,
    entityName,
    previousData:  before,
    newData:       after,
    changedFields,
    financialData,
    metadata,
    tags,
  });
}

// ─── public API ──────────────────────────────────────────────────────────────

export const auditService = {
  writeLog,

  // subscriber
  logSubscriberCreated,
  logSubscriberUpdated,
  logSubscriberRenewed,
  logSubscriberFrozen,
  logSubscriberResumed,
  logSubscriberWithdrawn,
  logSubscriberDeleted,

  // financial
  logPaymentCreated,
  logRefundCreated,

  // user
  logUserCreated,
  logUserUpdated,
  logRoleChanged,
  logPermissionsChanged,
  logAccountStatusChanged,

  // auth
  logLoginSuccess,
  logLoginFailed,
  logLogout,

  // system
  logAnalyticsExported,
  logDataExported,
  logSettingsUpdated,

  // unified interface
  track,

  // static maps for UI consumption
  ACTION_SEVERITY,
  ACTION_CATEGORY,
};
