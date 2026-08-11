import {
  collection, updateDoc, doc,
  query, where, getDocs,
   limit, Timestamp, arrayUnion} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { auth } from "@/lib/auth";
import type {
  
  NotificationCategory,
  NotificationSeverity,
  NotificationMinRole} from "@/types";

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
  targetUserIds?: string[];
}

/**
 * Creates a notification through /api/notifications/create.
 *
 * firestore.rules only permits `create` on notifications for staff, so writing
 * with addDoc() from here dropped every notification raised by an employee —
 * silently, because the rejection landed in the catch below. The route writes
 * with the Admin SDK and derives the performer from the verified token.
 *
 * markAsRead / archiveNotification still write from the client: the rules allow
 * any active user to touch readBy and archived.
 */
async function create(params: CreateParams): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch("/api/notifications/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`notifications/create responded ${response.status}`);
    }
  } catch (err) {
    // Contained so a failed notification never breaks the action that raised
    // it, but logged at error level so monitoring picks it up.
    console.error("[notification] create failed:", err);
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
      readBy: arrayUnion(uid),
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

/**
 * تنبيه موظف المتابعة المعيَّن لكل مشترك ينتهي اشتراكه خلال window أيام.
 * يُنشئ إشعاراً واحداً لكل موظف يجمع جميع مشتركيه المنتهية قريباً.
 */
async function createRenewalRemindersForAssignedEmployees(
  windowDays = 7
): Promise<void> {
  try {
    const today   = new Date().toISOString().split("T")[0];
    const inXDays = new Date(Date.now() + windowDays * 86_400_000).toISOString().split("T")[0];

    const snap = await getDocs(query(
      collection(db, "subscribers"),
      where("subscriptionState", "==",  "active"),
      where("expiryDate",        ">=",  today),
      where("expiryDate",        "<=",  inXDays),
      limit(200)
    ));

    if (snap.empty) return;

    // Group by assignedSalesId (or any assigned employee)
    const byEmployee = new Map<string, { name: string; subscribers: string[] }>();
    snap.docs.forEach((d) => {
      const data = d.data();
      const empId   = (data.assignedSalesId as string) ?? "";
      const empName = (data.assignedSalesName as string) ?? "";
      const subName = (data.name as string) ?? "";
      const subId   = d.id;

      if (!empId) return;
      if (!byEmployee.has(empId)) byEmployee.set(empId, { name: empName, subscribers: [] });
      byEmployee.get(empId)!.subscribers.push(`${subName} (${subId})`);
    });

    // One notification per employee — dedup per employee+day
    const today0 = today; // YYYY-MM-DD
    const promises: Promise<void>[] = [];

    byEmployee.forEach(({ name: empName, subscribers }, empId) => {
      const notifType = `renewal_reminder_${empId}_${today0}`;
      promises.push(
        createSmartAlert({
          type:         notifType,
          category:     "operational",
          severity:     "warning",
          title:        `تذكير بتجديد ${subscribers.length} مشترك`,
          description:  `المشتركون التالية اشتراكاتهم تنتهي خلال ${windowDays} أيام: ${subscribers.slice(0, 5).map((s) => s.split(" (")[0]).join("، ")}${subscribers.length > 5 ? ` وآخرون` : ""}`,
          targetMinRole: "employee",
          targetUserIds: [empId],
          actionUrl:    "/",
          metadata:     { empId, empName, count: subscribers.length, windowDays },
          expiresInDays: 1,
        })
      );
    });

    await Promise.allSettled(promises);
  } catch (err) {
    console.warn("[notification] createRenewalRemindersForAssignedEmployees:", err);
  }
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
  createRenewalRemindersForAssignedEmployees,

  createSmartAlert,
};
