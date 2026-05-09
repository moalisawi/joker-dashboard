/**
 * Granular, structured permission model.
 * Stored optionally on each user document; when present it overrides role defaults.
 */

export type AccountStatus = "active" | "suspended" | "disabled" | "pending";

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
      view:   "عرض",
      create: "إضافة",
      edit:   "تعديل",
      delete: "حذف",
    },
  },
  subscriptions: {
    label: "الاشتراكات",
    actions: {
      renew:    "تجديد",
      freeze:   "تجميد",
      resume:   "استئناف",
      withdraw: "انسحاب",
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
