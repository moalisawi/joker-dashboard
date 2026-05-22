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
  PAYMENT_METHODS:         "paymentMethods",
  EXCHANGE_RATES:          "exchangeRates",
  LOGIN_SESSIONS:          "loginSessions",
  FAILED_LOGINS:           "failedLogins",
  WHATSAPP_LEADS:          "whatsappLeads",
  WHATSAPP_MESSAGES:       "whatsappMessages",
  CANNED_RESPONSES:        "cannedResponses",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
