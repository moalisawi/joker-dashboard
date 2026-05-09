import {
  collection, addDoc, updateDoc, doc,
  serverTimestamp, query, where, getDocs,
  orderBy, limit, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import type {
  AppNotification,
  NotificationCategory,
  NotificationSeverity,
  NotificationMinRole,
} from "@/types";

// ─── action → notification config map ────────────────────────────────────────

interface NotifConfig {
  type:      string;
  category:  NotificationCategory;
  severity:  NotificationSeverity;
  title:     (name?: string) => string;
  minRole:   NotificationMinRole;
  actionUrl?: (entityId?: string) => string;
}

const ACTION_MAP: Record<string, NotifConfig> = {
  subscriber_created: {
    type: "renewal_created", category: "operational", severity: "success",
    title: (n) => `تم إضافة مشترك جديد${n ? `: ${n}` : ""}`,
    minRole: "employee",
    actionUrl: () => "/",
  },
  subscriber_renewed: {
    type: "renewal_created", category: "operational", severity: "success",
    title: (n) => `تجديد اشتراك${n ? `: ${n}` : ""}`,
    minRole: "employee",
    actionUrl: () => "/",
  },
  subscriber_frozen: {
    type: "subscription_frozen", category: "operational", severity: "warning",
    title: (n) => `تجميد اشتراك${n ? `: ${n}` : ""}`,
    minRole: "employee",
    actionUrl: () => "/",
  },
  subscriber_resumed: {
    type: "subscription_resumed", category: "operational", severity: "info",
    title: (n) => `استئناف اشتراك${n ? `: ${n}` : ""}`,
    minRole: "employee",
    actionUrl: () => "/",
  },
  subscriber_withdrawn: {
    type: "withdrawal_created", category: "operational", severity: "warning",
    title: (n) => `انسحاب مشترك${n ? `: ${n}` : ""}`,
    minRole: "admin",
    actionUrl: () => "/",
  },
  subscriber_deleted: {
    type: "withdrawal_created", category: "operational", severity: "critical",
    title: (n) => `حذف مشترك${n ? `: ${n}` : ""}`,
    minRole: "admin",
    actionUrl: () => "/",
  },
  payment_created: {
    type: "renewal_created", category: "financial", severity: "success",
    title: (n) => `دفعة جديدة${n ? ` من ${n}` : ""}`,
    minRole: "admin",
    actionUrl: () => "/",
  },
  refund_created: {
    type: "refund_created", category: "financial", severity: "warning",
    title: (n) => `استرداد مالي${n ? ` لـ ${n}` : ""}`,
    minRole: "admin",
    actionUrl: () => "/",
  },
  user_created: {
    type: "user_created", category: "user", severity: "info",
    title: (n) => `مستخدم جديد${n ? `: ${n}` : ""}`,
    minRole: "admin",
    actionUrl: () => "/users",
  },
  role_changed: {
    type: "role_changed", category: "security", severity: "warning",
    title: (n) => `تغيير دور${n ? ` لـ ${n}` : ""}`,
    minRole: "owner",
    actionUrl: () => "/users",
  },
  permissions_changed: {
    type: "permission_changed", category: "security", severity: "warning",
    title: (n) => `تعديل صلاحيات${n ? ` لـ ${n}` : ""}`,
    minRole: "owner",
    actionUrl: () => "/users",
  },
  account_activated: {
    type: "account_activated", category: "user", severity: "success",
    title: (n) => `تفعيل حساب${n ? `: ${n}` : ""}`,
    minRole: "admin",
    actionUrl: () => "/users",
  },
  account_suspended: {
    type: "account_suspended", category: "security", severity: "critical",
    title: (n) => `تعليق حساب${n ? `: ${n}` : ""}`,
    minRole: "owner",
    actionUrl: () => "/users",
  },
  account_disabled: {
    type: "user_disabled", category: "security", severity: "critical",
    title: (n) => `تعطيل حساب${n ? `: ${n}` : ""}`,
    minRole: "owner",
    actionUrl: () => "/users",
  },
  login_failed: {
    type: "login_failed", category: "security", severity: "critical",
    title: (n) => `فشل تسجيل الدخول${n ? ` (${n})` : ""}`,
    minRole: "owner",
    actionUrl: () => "/logs",
  },
};

// ─── core create ──────────────────────────────────────────────────────────────

interface CreateParams {
  type:         string;
  category:     NotificationCategory;
  severity:     NotificationSeverity;
  title:        string;
  description:  string;
  targetMinRole: NotificationMinRole;
  actionUrl?:   string;
  entityType?:  string;
  entityId?:    string;
  entityName?:  string;
  performedBy?: { uid: string; name: string; role: string };
  financialData?: { amount?: number; currency?: string; amountUSD?: number };
  metadata?:    Record<string, unknown>;
  expiresInDays?: number;
}

async function create(params: CreateParams): Promise<void> {
  try {
    const expiresAt = params.expiresInDays
      ? Timestamp.fromMillis(Date.now() + params.expiresInDays * 86_400_000)
      : null;

    await addDoc(collection(db, "notifications"), {
      type:         params.type,
      category:     params.category,
      severity:     params.severity,
      title:        params.title,
      description:  params.description,
      targetMinRole: params.targetMinRole,
      actionUrl:    params.actionUrl ?? null,
      entityType:   params.entityType  ?? null,
      entityId:     params.entityId    ?? null,
      entityName:   params.entityName  ?? null,
      performedBy:  params.performedBy ?? null,
      financialData: params.financialData ?? null,
      metadata:     params.metadata    ?? {},
      readBy:       [],
      archived:     false,
      expiresAt,
      createdAt:    serverTimestamp(),
    });
  } catch (err) {
    console.warn("[notification] create failed:", err);
  }
}

// ─── from audit event ─────────────────────────────────────────────────────────

interface AuditEventParams {
  action:       string;
  entityType?:  string;
  entityId?:    string;
  entityName?:  string;
  description?: string;
  performedBy?: { uid: string; name: string; email: string; role: string };
  financialData?: { amount?: number; currency?: string; amountUSD?: number; impactType?: string };
  metadata?:    Record<string, unknown>;
}

function createFromAuditAction(params: AuditEventParams): void {
  const cfg = ACTION_MAP[params.action];
  if (!cfg) return;

  const performer = params.performedBy
    ? { uid: params.performedBy.uid, name: params.performedBy.name, role: params.performedBy.role }
    : undefined;

  const fin = params.financialData?.amountUSD
    ? {
        amount:    params.financialData.amount,
        currency:  params.financialData.currency,
        amountUSD: params.financialData.amountUSD,
      }
    : undefined;

  create({
    type:         cfg.type,
    category:     cfg.category,
    severity:     cfg.severity,
    title:        cfg.title(params.entityName),
    description:  params.description ?? cfg.title(params.entityName),
    targetMinRole: cfg.minRole,
    actionUrl:    cfg.actionUrl?.(params.entityId),
    entityType:   params.entityType,
    entityId:     params.entityId,
    entityName:   params.entityName,
    performedBy:  performer,
    financialData: fin,
    metadata:     params.metadata,
    expiresInDays: 30,
  }).catch(console.warn);
}

// ─── read / archive ───────────────────────────────────────────────────────────

async function markAsRead(notificationId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      readBy: [...(await getReadBy(notificationId)), uid].filter((v, i, a) => a.indexOf(v) === i),
    });
  } catch (err) {
    console.warn("[notification] markAsRead failed:", err);
  }
}

async function markAllAsRead(notificationIds: string[], uid: string): Promise<void> {
  // Firestore batch would be ideal; for small lists this is fine
  await Promise.allSettled(notificationIds.map((id) => markAsRead(id, uid)));
}

async function archiveNotification(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "notifications", notificationId), { archived: true });
  } catch (err) {
    console.warn("[notification] archive failed:", err);
  }
}

async function getReadBy(id: string): Promise<string[]> {
  try {
    const { getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "notifications", id));
    return (snap.data()?.readBy as string[]) ?? [];
  } catch {
    return [];
  }
}

// ─── smart alert helpers ──────────────────────────────────────────────────────

async function createSmartAlert(params: Omit<CreateParams, "readBy" | "archived">): Promise<void> {
  // Dedup: don't create the same type of alert if one exists in the last 12h
  try {
    const twelveHoursAgo = Timestamp.fromMillis(Date.now() - 12 * 3600_000);
    const existing = await getDocs(
      query(
        collection(db, "notifications"),
        where("type", "==", params.type),
        where("archived", "==", false),
        where("createdAt", ">", twelveHoursAgo),
        limit(1)
      )
    );
    if (!existing.empty) return; // already have a recent one
  } catch {
    // ignore dedup errors — still create the alert
  }
  return create(params);
}

async function createHighRefundAlert(totalRefundsUSD: number, changePercent: number): Promise<void> {
  return createSmartAlert({
    type:         "high_refund_activity",
    category:     "financial",
    severity:     "warning",
    title:        `نشاط استرداد مرتفع هذا الأسبوع`,
    description:  `ارتفعت الاستردادات بنسبة ${changePercent.toFixed(0)}% مقارنةً بالأسبوع الماضي (${totalRefundsUSD.toFixed(0)} USD)`,
    targetMinRole: "admin",
    actionUrl:    "/analytics",
    metadata:     { totalRefundsUSD, changePercent },
    expiresInDays: 7,
  });
}

async function createFailedLoginAlert(count: number, email?: string): Promise<void> {
  return createSmartAlert({
    type:         "login_failed",
    category:     "security",
    severity:     "critical",
    title:        `محاولات دخول فاشلة متعددة`,
    description:  `تم رصد ${count} محاولة دخول فاشلة${email ? ` لـ ${email}` : ""} خلال الساعة الماضية`,
    targetMinRole: "owner",
    actionUrl:    "/logs",
    metadata:     { count, email },
    expiresInDays: 3,
  });
}

async function createWithdrawalSpikeAlert(count: number, changePercent: number): Promise<void> {
  return createSmartAlert({
    type:         "withdrawal_created",
    category:     "operational",
    severity:     "warning",
    title:        `ارتفاع في الانسحابات`,
    description:  `ارتفعت الانسحابات بنسبة ${changePercent.toFixed(0)}% هذا الأسبوع (${count} انسحاب)`,
    targetMinRole: "admin",
    actionUrl:    "/",
    metadata:     { count, changePercent },
    expiresInDays: 7,
  });
}

async function createUnusualRefundAlert(employeeName: string, count: number, totalUSD: number): Promise<void> {
  return createSmartAlert({
    type:         "unusual_refunds",
    category:     "security",
    severity:     "critical",
    title:        `نشاط استرداد غير مألوف`,
    description:  `قام ${employeeName} بمعالجة ${count} استردادات بإجمالي ${totalUSD.toFixed(0)} USD`,
    targetMinRole: "owner",
    actionUrl:    "/logs",
    metadata:     { employeeName, count, totalUSD },
    expiresInDays: 3,
  });
}

async function createRevenuDropAlert(current: number, previous: number): Promise<void> {
  const drop = (((previous - current) / Math.max(previous, 1)) * 100).toFixed(0);
  return createSmartAlert({
    type:         "revenue_drop",
    category:     "financial",
    severity:     "warning",
    title:        `انخفاض في الإيرادات`,
    description:  `انخفضت إيرادات هذا الأسبوع بنسبة ${drop}% مقارنةً بالأسبوع الماضي`,
    targetMinRole: "admin",
    actionUrl:    "/analytics",
    metadata:     { currentRevenue: current, previousRevenue: previous },
    expiresInDays: 7,
  });
}

async function createExpiringSubscriptionAlert(count: number): Promise<void> {
  return createSmartAlert({
    type:         "subscription_expiring",
    category:     "operational",
    severity:     "warning",
    title:        `اشتراكات تنتهي قريباً`,
    description:  `${count} اشتراك ينتهي خلال 3 أيام — يرجى التواصل مع المشتركين`,
    targetMinRole: "employee",
    actionUrl:    "/",
    metadata:     { count },
    expiresInDays: 2,
  });
}

// ─── public API ───────────────────────────────────────────────────────────────

export const notificationService = {
  create,
  createFromAuditAction,
  markAsRead,
  markAllAsRead,
  archiveNotification,

  // smart alert creators
  createHighRefundAlert,
  createFailedLoginAlert,
  createWithdrawalSpikeAlert,
  createUnusualRefundAlert,
  createRevenuDropAlert,
  createExpiringSubscriptionAlert,

  createSmartAlert,
};
