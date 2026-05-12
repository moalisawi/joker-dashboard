// Subscriber display statuses (Arabic labels stored in Firestore)
export const SUBSCRIBER_STATUS = {
  ACTIVE:          "نشط",
  EXPIRING_SOON:   "ينتهي قريباً",
  EXPIRED:         "منتهي",
  WITHDRAWN:       "منسحب",
  PAUSED:          "موقوف",
  FROZEN:          "متجمد",
} as const;

// Subscription lifecycle states
export const SUBSCRIPTION_STATE = {
  ACTIVE:    "active",
  WITHDRAWN: "withdrawn",
} as const;

// Subscription operational status
export const SUBSCRIPTION_STATUS = {
  ACTIVE:    "active",
  PAUSED:    "paused",
  EXPIRED:   "expired",
  WITHDRAWN: "withdrawn",
  FROZEN:    "frozen",
} as const;

// User account statuses
export const ACCOUNT_STATUS = {
  ACTIVE:    "active",
  SUSPENDED: "suspended",
  DISABLED:  "disabled",
  PENDING:   "pending",
} as const;

// Payment types
export const PAYMENT_TYPE = {
  INITIAL:     "initial",
  INSTALLMENT: "installment",
  RENEWAL:     "renewal",
  REFUND:      "refund",
} as const;

// Supported currencies
export const CURRENCY = {
  USD: "USD",
  EGP: "EGP",
  JOD: "JOD",
  ILS: "ILS",
} as const;

export type SubscriberStatusValue   = (typeof SUBSCRIBER_STATUS)[keyof typeof SUBSCRIBER_STATUS];
export type SubscriptionStateValue  = (typeof SUBSCRIPTION_STATE)[keyof typeof SUBSCRIPTION_STATE];
export type SubscriptionStatusValue = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
export type AccountStatusValue      = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
export type PaymentTypeValue        = (typeof PAYMENT_TYPE)[keyof typeof PAYMENT_TYPE];
export type CurrencyValue           = (typeof CURRENCY)[keyof typeof CURRENCY];
