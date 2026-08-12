import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

interface NotifConfig {
  category:  string;
  severity:  string;
  minRole:   string;
  title:     (name?: string) => string;
  actionUrl: string;
  ttlDays:   number;
}

const ACTION_MAP: Record<string, NotifConfig> = {
  subscriber_created: {
    category: "operational", severity: "success", minRole: "employee",
    title: (n) => `تم إضافة مشترك جديد${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  subscriber_renewed: {
    category: "operational", severity: "success", minRole: "employee",
    title: (n) => `تجديد اشتراك${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  subscriber_frozen: {
    category: "operational", severity: "warning", minRole: "employee",
    title: (n) => `تجميد اشتراك${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  subscriber_resumed: {
    category: "operational", severity: "info", minRole: "employee",
    title: (n) => `استئناف اشتراك${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  subscriber_paused: {
    category: "operational", severity: "warning", minRole: "employee",
    title: (n) => `إيقاف اشتراك مؤقت${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  subscriber_withdrawn: {
    category: "operational", severity: "warning", minRole: "admin",
    title: (n) => `انسحاب مشترك${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  subscriber_deleted: {
    category: "operational", severity: "critical", minRole: "admin",
    title: (n) => `حذف مشترك${n ? `: ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  payment_created: {
    category: "financial", severity: "success", minRole: "admin",
    title: (n) => `دفعة جديدة${n ? ` من ${n}` : ""}`,
    actionUrl: "/", ttlDays: 30,
  },
  role_changed: {
    category: "security", severity: "warning", minRole: "owner",
    title: (n) => `تغيير دور${n ? ` لـ ${n}` : ""}`,
    actionUrl: "/admin/employees", ttlDays: 30,
  },
  permissions_changed: {
    category: "security", severity: "warning", minRole: "owner",
    title: (n) => `تعديل صلاحيات${n ? ` لـ ${n}` : ""}`,
    actionUrl: "/admin/employees", ttlDays: 30,
  },
  account_activated: {
    category: "user", severity: "success", minRole: "admin",
    title: (n) => `تفعيل حساب${n ? `: ${n}` : ""}`,
    actionUrl: "/admin/employees", ttlDays: 30,
  },
  account_suspended: {
    category: "security", severity: "critical", minRole: "owner",
    title: (n) => `تعليق حساب${n ? `: ${n}` : ""}`,
    actionUrl: "/admin/employees", ttlDays: 30,
  },
  account_disabled: {
    category: "security", severity: "critical", minRole: "owner",
    title: (n) => `تعطيل حساب${n ? `: ${n}` : ""}`,
    actionUrl: "/admin/employees", ttlDays: 30,
  },
};

interface CreateParams {
  action:      string;
  entityType?: string;
  entityId?:   string;
  entityName?: string;
  description?: string;
  performedBy?: { uid: string; name: string; role: string };
  financialData?: { amount?: number; currency?: string; amountUSD?: number } | null;
  metadata?:   Record<string, unknown>;
}

export async function createServerNotification(params: CreateParams): Promise<void> {
  const cfg = ACTION_MAP[params.action];
  if (!cfg) return;

  try {
    const expiresAt = Timestamp.fromMillis(Date.now() + cfg.ttlDays * 86_400_000);
    await getFirestore().collection("notifications").add({
      type:          params.action,
      category:      cfg.category,
      severity:      cfg.severity,
      title:         cfg.title(params.entityName),
      description:   params.description ?? cfg.title(params.entityName),
      targetMinRole: cfg.minRole,
      targetUserIds: null,
      actionUrl:     cfg.actionUrl,
      entityType:    params.entityType  ?? null,
      entityId:      params.entityId    ?? null,
      entityName:    params.entityName  ?? null,
      performedBy:   params.performedBy ?? null,
      financialData: params.financialData ?? null,
      metadata:      params.metadata    ?? {},
      readBy:        [],
      archived:      false,
      expiresAt,
      createdAt:     FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[serverNotification] create failed:", err);
  }
}
