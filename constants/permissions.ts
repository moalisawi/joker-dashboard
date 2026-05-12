// Flat permission keys (backward-compatible)
export const FLAT_PERMISSIONS = {
  CAN_VIEW_ALL:      "canViewAll",
  CAN_VIEW_REVENUE:  "canViewRevenue",
  CAN_CREATE:        "canCreate",
  CAN_EDIT:          "canEdit",
  CAN_WITHDRAW:      "canWithdraw",
  CAN_DELETE:        "canDelete",
  CAN_MANAGE_USERS:  "canManageUsers",
  CAN_VIEW_LOGS:     "canViewLogs",
} as const;

// Granular permission categories
export const PERMISSION_CATEGORY = {
  SUBSCRIBERS:   "subscribers",
  SUBSCRIPTIONS: "subscriptions",
  PAYMENTS:      "payments",
  ANALYTICS:     "analytics",
  LOGS:          "logs",
  USERS:         "users",
  SETTINGS:      "settings",
} as const;

// Granular permission actions per category
export const PERMISSION_ACTION = {
  VIEW:              "view",
  CREATE:            "create",
  EDIT:              "edit",
  DELETE:            "delete",
  RENEW:             "renew",
  FREEZE:            "freeze",
  RESUME:            "resume",
  WITHDRAW:          "withdraw",
  REFUND:            "refund",
  EXPORT:            "export",
  MANAGE:            "manage",
  CHANGE_ROLES:      "changeRoles",
  ACTIVATE_ACCOUNTS: "activateAccounts",
} as const;

export type FlatPermissionKey       = (typeof FLAT_PERMISSIONS)[keyof typeof FLAT_PERMISSIONS];
export type PermissionCategoryKey   = (typeof PERMISSION_CATEGORY)[keyof typeof PERMISSION_CATEGORY];
export type PermissionActionKey     = (typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION];

// ─── Granular flat permission string keys (new perm system) ───────────────────
// These map 1-to-1 with GranularPermissions fields and are used by permissionGuards.

export const PERM = {
  // Subscribers
  VIEW_SUBSCRIBERS:    "view_subscribers",
  CREATE_SUBSCRIBERS:  "create_subscribers",
  EDIT_SUBSCRIBERS:    "edit_subscribers",
  DELETE_SUBSCRIBERS:  "delete_subscribers",
  ASSIGN_SUBSCRIBERS:  "assign_subscribers",

  // Subscriptions
  RENEW_SUBSCRIPTIONS: "renew_subscriptions",
  FREEZE_SUBSCRIPTIONS:"freeze_subscriptions",
  RESUME_SUBSCRIPTIONS:"resume_subscriptions",
  WITHDRAW_SUBSCRIPTIONS:"withdraw_subscriptions",

  // Payments
  CREATE_PAYMENTS:     "create_payments",
  REVIEW_PAYMENTS:     "review_payments",
  REFUND_PAYMENTS:     "refund_payments",

  // Analytics
  VIEW_REVENUE:        "view_revenue",
  EXPORT_ANALYTICS:    "export_analytics",

  // Logs
  VIEW_LOGS:           "view_logs",

  // Users
  MANAGE_USERS:        "manage_users",
  MANAGE_PERMISSIONS:  "manage_permissions",
  ACTIVATE_ACCOUNTS:   "activate_accounts",

  // Settings
  MANAGE_SETTINGS:     "manage_settings",
} as const;

export type PermKey = (typeof PERM)[keyof typeof PERM];
