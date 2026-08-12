/**
 * Granular, structured permission model.
 * Stored optionally on each user document; when present it overrides role defaults.
 *
 * Every action listed here is real: it appears in ROLE_CEILING, in the role and
 * job presets, in granularPermissionsSchema (so it survives a save), and in
 * PERMISSION_LABELS (so it is offered in the editor). Those four lists are kept
 * in step by __tests__/lib/permissionSurface.test.ts.
 *
 * They were not always in step. `subscribers.assign / transfer / changeStatus /
 * viewNotes / addNotes` and `subscriptions.manageRenewals` were declared here and
 * rendered as checkboxes, but the ceiling did not carry them, the save schema
 * stripped them, and effectivePermissions — which iterates the ceiling — dropped
 * them. An owner could tick "نقل" for an employee, see it saved, and the
 * employee would still hold nothing. Do not add an action here without adding it
 * to the other three.
 */

/**
 * Account lifecycle state.
 *
 * `deleted` is a soft-delete/archive marker, not a row that has gone away: the
 * uid is kept so historical records that reference it stay legible. It is listed
 * here because Firestore has been storing it since the delete route was written
 * — leaving it out of the union only meant every consumer had to special-case an
 * unknown string.
 */
export type AccountStatus = "active" | "suspended" | "disabled" | "pending" | "deleted";

export interface GranularPermissions {
  subscribers: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  subscriptions: {
    renew: boolean;
    freeze: boolean;
    resume: boolean;
    withdraw: boolean;
  };
  payments: {
    create: boolean;
    edit: boolean;
    refund: boolean;
  };
  analytics: {
    view: boolean;
    export: boolean;
  };
  logs: {
    view: boolean;
  };
  users: {
    manage: boolean;
    changeRoles: boolean;
    activateAccounts: boolean;
  };
  settings: {
    manage: boolean;
  };
}

/** Human-readable labels for each permission category and action (Arabic) */
export const PERMISSION_LABELS: Record<
  keyof GranularPermissions,
  { label: string; actions: Record<string, string> }
> = {
  subscribers: {
    label: "المشتركون",
    actions: {
      view:        "عرض",
      create:      "إضافة",
      edit:        "تعديل",
      delete:      "حذف",
    },
  },
  subscriptions: {
    label: "الاشتراكات",
    actions: {
      renew:          "تجديد",
      freeze:         "تجميد",
      resume:         "استئناف",
      withdraw:       "انسحاب",
    },
  },
  payments: {
    label: "المدفوعات",
    actions: {
      create: "إضافة دفعة",
      edit:   "تعديل",
      refund: "استرداد",
    },
  },
  analytics: {
    label: "التحليلات",
    actions: {
      view:   "عرض",
      export: "تصدير",
    },
  },
  logs: {
    label: "السجلات",
    actions: {
      view: "عرض",
    },
  },
  users: {
    label: "المستخدمون",
    actions: {
      manage:           "إدارة",
      changeRoles:      "تغيير الأدوار",
      activateAccounts: "تفعيل الحسابات",
    },
  },
  settings: {
    label: "الإعدادات",
    actions: {
      manage: "إدارة",
    },
  },
};

/**
 * One sentence per action, phrased as what the holder may do. The permissions
 * editor is a grid of 20 checkboxes; these are what turn it into an answer to
 * "what will this person be able to do?".
 */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "subscribers.view":       "عرض المشتركين",
  "subscribers.create":     "إضافة مشتركين جدد",
  "subscribers.edit":       "تعديل بيانات المشتركين وإسنادهم",
  "subscribers.delete":     "حذف مشترك",
  "subscriptions.renew":    "تجديد الاشتراكات",
  "subscriptions.freeze":   "تجميد الاشتراكات",
  "subscriptions.resume":   "استئناف الاشتراكات المجمّدة",
  "subscriptions.withdraw": "تسجيل انسحاب مشترك",
  "payments.create":        "تسجيل دفعات",
  "payments.edit":          "تعديل الدفعات ومراجعتها",
  "payments.refund":        "تنفيذ عمليات استرداد",
  "analytics.view":         "عرض الإيرادات والتحليلات",
  "analytics.export":       "تصدير التقارير",
  "logs.view":              "عرض سجل العمليات",
  "users.manage":           "إدارة المستخدمين والموظفين",
  "users.changeRoles":      "تغيير أدوار المستخدمين وصلاحياتهم",
  "users.activateAccounts": "تفعيل الحسابات وتعطيلها",
  "settings.manage":        "إدارة الإعدادات وطرق الدفع",
};
