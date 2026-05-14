export const COLLECTIONS = {
  SUBSCRIBERS:             "subscribers",
  USERS:                   "users",
  PAYMENTS:                "payments",
  REFUNDS:                 "refunds",
  AUDIT_LOGS:              "auditLogs",
  NOTIFICATIONS:           "notifications",
  MONTHLY_ANALYTICS:       "monthlyAnalytics",
  TEAMS:                   "teams",
  SUBSCRIBER_NOTES:        "subscriberNotes",
  SUBSCRIBER_ASSIGNMENTS:  "subscriberAssignments",
  ACTIVITY_LOGS:           "activityLogs",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
