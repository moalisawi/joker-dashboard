# Database Schema — Joker Dashboard

> **Engine**: Firebase Firestore (NoSQL Document Store)  
> **Generated**: 2026-05-20  
> **Version**: 0.1.0

---

## Collections Overview

| Collection | Description | Estimated Volume |
|---|---|---|
| `subscribers` | Core subscription records | High |
| `users` | User accounts & profiles | Low |
| `payments` | Payment transactions | High |
| `refunds` | Refund transactions | Medium |
| `auditLogs` | Full audit trail | Very High |
| `notifications` | In-app notifications | High |
| `monthlyAnalytics` | Pre-aggregated analytics | Low |
| `teams` | Team groupings | Low |
| `subscriberNotes` | Internal notes per subscriber | Medium |
| `subscriberAssignments` | Assignment history | Medium |
| `activityLogs` | Team/employee activity events | High |
| `paymentMethods` | Payment method definitions | Low |
| `exchangeRates` | Currency exchange rates | Low |
| `loginSessions` | Active & historical login sessions | High |
| `failedLogins` | Failed login attempts | Medium |
| `whatsappLeads` | WhatsApp lead prospects | Medium |
| `whatsappMessages` | WhatsApp message history | High |
| `cannedResponses` | Pre-written WhatsApp responses | Low |

---

## Enumerations & Value Domains

```
Role              = "owner" | "admin" | "employee"
EmployeeRole      = "sales" | "followup" | "team_leader" | "admin" | "owner"
AccountStatus     = "active" | "suspended" | "disabled" | "pending"

SubscriberStatus  = "نشط" | "ينتهي قريباً" | "منتهي" | "منسحب" | "موقوف" | "متجمد"
SubscriptionState = "active" | "withdrawn"
SubscriptionStatus= "active" | "paused" | "expired" | "withdrawn" | "frozen"
WorkflowStatus    = "new" | "interested" | "follow_up" | "awaiting_payment"
                  | "active" | "paused" | "completed" | "cancelled" | "refunded"
RenewalWorkflow   = "pending" | "contacted" | "renewed" | "declined"
AssignmentType    = "sales" | "nutrition" | "owner" | "unassigned"
NoteType          = "sales" | "nutrition" | "renewal" | "payment" | "general"

PackageType       = "فضية" | "ذهبية"
Currency          = "USD" | "EGP" | "JOD" | "ILS"
PaymentType       = "initial" | "installment" | "renewal" | "refund"

AuditCategory     = "subscriber" | "financial" | "user" | "auth" | "system" | "whatsapp"
AuditSeverity     = "info" | "success" | "warning" | "critical"
AuditSource       = "dashboard" | "system" | "api"

NotificationCategory = "operational" | "financial" | "security" | "user" | "insight"
NotificationSeverity = "info" | "success" | "warning" | "critical"

TeamType          = "sales" | "nutrition"
DeviceType        = "desktop" | "mobile" | "tablet"
SessionStatus     = "active" | "logged_out" | "expired" | "suspicious"

LeadStatus        = "مهتم" | "جاهز للدفع" | "متابعة هامة" | "جديد" | "إعادة استهداف"
ConversationStatus= "مفتوحة" | "مغلقة" | "مؤرشفة"
```

---

## Collection Schemas

---

### `users`

Stores all user profiles (owners, admins, employees).

```
users/{uid}
├── uid                   : string           — Firebase Auth UID (= document ID)
├── email                 : string
├── name                  : string
├── employeeName          : string?
├── role                  : Role
├── isEmployee            : boolean?
├── employeeRole          : EmployeeRole?
├── department            : string?          — "مبيعات" | "متابعة" | "إدارة" | "أخرى"
├── notes                 : string?
├── status                : AccountStatus
├── active                : boolean
├── phone                 : string?
├── teamId                : string?          — ref → teams/{id}
├── granularPermissions   : GranularPermissions?
│   ├── subscribers
│   │   ├── view          : boolean
│   │   ├── create        : boolean
│   │   ├── edit          : boolean
│   │   ├── delete        : boolean
│   │   ├── assign        : boolean?
│   │   ├── transfer      : boolean?
│   │   ├── changeStatus  : boolean?
│   │   ├── viewNotes     : boolean?
│   │   └── addNotes      : boolean?
│   ├── subscriptions
│   │   ├── renew         : boolean
│   │   ├── freeze        : boolean
│   │   ├── resume        : boolean
│   │   ├── withdraw      : boolean
│   │   └── manageRenewals: boolean?
│   ├── payments
│   │   ├── create        : boolean
│   │   ├── edit          : boolean
│   │   └── refund        : boolean
│   ├── analytics
│   │   ├── view          : boolean
│   │   └── export        : boolean
│   ├── logs
│   │   └── view          : boolean
│   ├── users
│   │   ├── manage        : boolean
│   │   ├── changeRoles   : boolean
│   │   └── activateAccounts: boolean
│   └── settings
│       └── manage        : boolean
├── deleted               : boolean?
├── deletedAt             : Timestamp?
├── deletedBy             : string?          — ref → users/{uid}
├── createdAt             : Timestamp?
├── createdBy             : string?
├── updatedAt             : Timestamp?
├── updatedBy             : string?
└── lastLoginAt           : Timestamp?
```

**Indexes**: `role`, `active`, `teamId`, `status`

---

### `teams`

```
teams/{teamId}
├── id                    : string
├── name                  : string
├── type                  : TeamType         — "sales" | "nutrition"
├── active                : boolean
├── membersCount          : number
├── leaderId              : string | null     — ref → users/{uid}
├── description           : string | null
├── createdAt             : Timestamp
├── updatedAt             : Timestamp
├── createdBy             : string?
├── updatedBy             : string?
├── deleted               : boolean?
├── deletedAt             : Timestamp?
└── deletedBy             : string?
```

**Indexes**: `type`, `active`, `leaderId`

---

### `subscribers`

Core collection — one document per subscriber enrollment.

```
subscribers/{subscriberId}
│
├── — IDENTITY —
├── id                    : string
├── name                  : string
├── residence             : string
├── phoneCountry          : string           — ISO country code
├── dialCode              : string           — e.g. "+20"
├── phone                 : string
├── age                   : number | null?
│
├── — SUBSCRIPTION PLAN —
├── date                  : string           — enrollment date (YYYY-MM-DD)
├── startDate             : string?
├── package               : PackageType      — "فضية" | "ذهبية"
├── duration              : number           — months
├── expiryDate            : string           — YYYY-MM-DD
├── daysRemaining         : number
├── status                : SubscriberStatus
├── subscriptionState     : SubscriptionState
├── subscriptionStatus    : SubscriptionStatus?
│
├── — PRICING —
├── currencyOriginal      : Currency
├── currency              : Currency
├── lockedRate            : number           — exchange rate at time of signup
├── totalPrice            : number           — in original currency
├── totalPriceUSD         : number
├── paidAmount            : number
├── paidAmountUSD         : number
├── remainingAmount       : number
├── remainingAmountUSD    : number
├── netAmountUSD          : number           — after refunds
│
├── — ACQUISITION —
├── payment               : string           — payment method name
├── source                : string           — acquisition channel
├── referrer              : string?
├── convincedBy           : string           — employee name
├── paidShift             : string           — shift label
├── team                  : string           — team name at signup
├── notes                 : string?
│
├── — PAUSE SYSTEM —
├── pausedAt              : Timestamp | null?
├── pausedBy              : string | null?
├── pauseReason           : string | null?
├── remainingDaysAtPause  : number | null?
├── totalPausedDays       : number?
│
├── — FREEZE SYSTEM —
├── freezeData            : FreezeData?
│   ├── isFrozen          : boolean
│   ├── frozenAt          : Timestamp | null
│   ├── frozenBy          : string | null    — ref → users/{uid}
│   ├── freezeReason      : string?
│   ├── freezeNotes       : string?
│   ├── originalExpiryDate: string | null
│   ├── remainingDays     : number
│   ├── resumedAt         : Timestamp | null
│   └── resumedBy         : string | null
│
├── — WITHDRAWAL SYSTEM —
├── withdrawalDate        : Timestamp | null?
├── withdrawalReason      : string?
├── withdrawnAt           : string?
├── withdrawalData        : WithdrawalData?
│   ├── withdrawnAt       : Timestamp
│   ├── withdrawnBy       : string           — ref → users/{uid}
│   ├── withdrawnByName   : string
│   ├── withdrawalReason  : string
│   ├── notes             : string?
│   ├── refundIssued      : boolean
│   ├── refundId          : string?          — ref → refunds/{id}
│   ├── refundAmount      : number?
│   ├── refundCurrency    : Currency?
│   ├── refundAmountUSD   : number?
│   ├── exchangeRate      : number?
│   ├── originalPlan      : string
│   ├── originalExpiryDate: string
│   ├── previousStatus    : string
│   ├── activeDaysUsed    : number
│   └── remainingDays     : number
│
├── — RENEWALS —
├── renewals              : RenewalSnapshot[]
│   └── []
│       ├── package       : PackageType
│       ├── startDate     : string
│       ├── endDate       : string
│       ├── duration      : number
│       ├── totalPrice    : number
│       ├── totalPriceUSD : number
│       ├── paidAmountUSD : number
│       ├── remainingAmountUSD: number
│       ├── netAmountUSD  : number
│       ├── currency      : Currency
│       ├── lockedRate    : number
│       ├── payment       : string
│       ├── convincedBy   : string
│       ├── paidShift     : string
│       ├── snapshotStatus: SubscriptionState | "expired"
│       ├── renewedAt     : Timestamp | null
│       ├── renewedBy     : string
│       └── renewedByName : string
├── renewalCount          : number
├── lifetimeValueUSD      : number
├── lastRenewalDate       : Timestamp | null?
│
├── — WORKFLOW / ASSIGNMENT —
├── assignedSalesId       : string | null?   — ref → users/{uid}
├── assignedSalesName     : string | null?
├── assignedNutritionistId: string | null?   — ref → users/{uid}
├── assignedNutritionistName: string | null?
├── assignedTeamId        : string | null?   — ref → teams/{id}
├── assignedTeamName      : string | null?
├── assignmentType        : AssignmentType?
├── assignmentHistory     : AssignmentHistoryEntry[]?
│   └── []
│       ├── assignedSalesId       : string | null?
│       ├── assignedSalesName     : string | null?
│       ├── assignedNutritionistId: string | null?
│       ├── assignedNutritionistName: string | null?
│       ├── assignedTeamId        : string | null?
│       ├── assignedTeamName      : string | null?
│       ├── assignmentType        : AssignmentType
│       ├── actorId               : string
│       ├── actorName             : string
│       ├── reason                : string?
│       └── timestamp             : Timestamp
├── workflowStatus        : WorkflowStatus?
├── workflowStatusChangedAt: Timestamp?
├── workflowStatusChangedBy: string?
├── workflowStatusNote    : string?
├── renewalWorkflowStatus : RenewalWorkflowStatus?
├── renewalSuggestedBy    : string | null?
├── renewalSuggestedByName: string | null?
├── renewalHandledBy      : string | null?
├── renewalHandledByName  : string | null?
├── renewalNote           : string?
│
├── — META —
├── createdAt             : Timestamp?
├── createdBy             : string?
├── updatedAt             : Timestamp?
└── updatedBy             : string?
```

**Indexes**: `status`, `subscriptionState`, `expiryDate`, `assignedSalesId`, `assignedNutritionistId`, `assignedTeamId`, `workflowStatus`, `package`, `convincedBy`, `team`, `createdAt`

---

### `payments`

One document per payment transaction.

```
payments/{paymentId}
├── subscriberId          : string           — ref → subscribers/{id}
├── subscriberName        : string
├── amountOriginal        : number
├── currencyOriginal      : Currency
├── exchangeRate          : number
├── amountUSD             : number
├── paymentMethod         : string
├── paymentMethodId       : string?          — ref → paymentMethods/{id}
├── paymentType           : PaymentType?     — "initial"|"installment"|"renewal"|"refund"
├── date                  : string           — YYYY-MM-DD
├── notes                 : string | null?
├── receiptUrl            : string | null?
├── receiptType           : string | null?
├── isInitialPayment      : boolean
├── isRenewalPayment      : boolean
├── renewalNumber         : number?          — 1-based renewal index
├── createdAt             : Timestamp?
└── createdBy             : string?          — ref → users/{uid}
```

**Indexes**: `subscriberId`, `createdBy`, `date`, `paymentType`, `isRenewalPayment`, `createdAt`

---

### `refunds`

One document per refund transaction.

```
refunds/{refundId}
├── subscriberId          : string           — ref → subscribers/{id}
├── subscriberName        : string
├── refundAmount          : number
├── refundCurrency        : Currency
├── exchangeRate          : number
├── refundAmountUSD       : number
├── refundDate            : string           — YYYY-MM-DD
├── refundReason          : string
├── notes                 : string?
├── relatedWithdrawalId   : string?
├── isWithdrawalRefund    : boolean?
├── financialImpact       : "negative"
├── createdAt             : Timestamp
├── createdBy             : string           — ref → users/{uid}
└── createdByName         : string?
```

**Indexes**: `subscriberId`, `createdBy`, `refundDate`, `isWithdrawalRefund`, `createdAt`

---

### `subscriberNotes`

Internal notes attached to a subscriber.

```
subscriberNotes/{noteId}
├── id                    : string
├── subscriberId          : string           — ref → subscribers/{id}
├── subscriberName        : string?
├── authorId              : string           — ref → users/{uid}
├── authorName            : string
├── content               : string
├── noteType              : NoteType
├── deleted               : boolean?
├── deletedAt             : Timestamp?
├── deletedBy             : string?
├── createdAt             : Timestamp
└── updatedAt             : Timestamp
```

**Indexes**: `subscriberId`, `authorId`, `noteType`, `createdAt`

---

### `subscriberAssignments`

Historical record of every assignment change.

```
subscriberAssignments/{assignmentId}
├── subscriberId          : string           — ref → subscribers/{id}
├── assignedSalesId       : string | null?
├── assignedSalesName     : string | null?
├── assignedNutritionistId: string | null?
├── assignedNutritionistName: string | null?
├── assignedTeamId        : string | null?
├── assignedTeamName      : string | null?
├── assignmentType        : AssignmentType
├── actorId               : string           — ref → users/{uid}
├── actorName             : string
├── reason                : string?
└── timestamp             : Timestamp
```

**Indexes**: `subscriberId`, `actorId`, `timestamp`

---

### `auditLogs`

Immutable audit trail for every operation.

```
auditLogs/{logId}
├── action                : string           — e.g. "subscriber_created"
├── category              : AuditCategory?
├── entityType            : string?          — e.g. "subscriber"
├── entityId              : string?
├── entityName            : string?
├── description           : string?
├── previousData          : Record<string, unknown>?
├── newData               : Record<string, unknown>?
├── changedFields         : string[]?
├── performedBy           : AuditPerformedBy?
│   ├── uid               : string
│   ├── name              : string
│   ├── email             : string
│   └── role              : string
├── targetUser            : AuditTargetUser?
│   ├── uid               : string?
│   ├── name              : string?
│   └── role              : string?
├── financialData         : AuditFinancialData?
│   ├── amount            : number?
│   ├── currency          : string?
│   ├── amountUSD         : number?
│   └── impactType        : "positive" | "negative" | "neutral"?
├── metadata              : Record<string, unknown>?
├── tags                  : string[]?
├── severity              : AuditSeverity?
├── status                : "completed" | "failed" | "pending"?
├── source                : AuditSource?
└── createdAt             : Timestamp?
```

**Indexes**: `action`, `category`, `severity`, `performedBy.uid`, `entityId`, `createdAt`  
**Note**: Write-once; never update or delete.

---

### `notifications`

In-app notification feed.

```
notifications/{notificationId}
├── type                  : string           — NotificationType
├── category              : NotificationCategory
├── title                 : string
├── description           : string
├── severity              : NotificationSeverity
├── readBy                : string[]         — array of user UIDs
├── archived              : boolean
├── actionUrl             : string?
├── entityType            : string?
├── entityId              : string?
├── entityName            : string?
├── performedBy           : NotificationPerformedBy?
│   ├── uid               : string
│   ├── name              : string
│   └── role              : string
├── financialData         : NotificationFinancialData?
│   ├── amount            : number?
│   ├── currency          : string?
│   └── amountUSD         : number?
├── metadata              : Record<string, unknown>?
├── targetMinRole         : "employee" | "admin" | "owner"
├── targetUserIds         : string[]?
├── createdAt             : Timestamp
└── expiresAt             : Timestamp?
```

**Indexes**: `category`, `severity`, `archived`, `targetMinRole`, `createdAt`, `expiresAt`

---

### `monthlyAnalytics`

Pre-aggregated monthly financial summaries (updated on every transaction).

```
monthlyAnalytics/{YYYY-MM}
├── id                    : string           — document ID = "YYYY-MM"
├── month                 : string           — "YYYY-MM"
├── totalPaymentsUSD      : number
├── totalRefundsUSD       : number
├── netRevenueUSD         : number
├── paymentCount          : number
├── refundCount           : number
├── withdrawalCount       : number
├── byEmployee            : Record<employeeId, EmployeeStats>?
│   └── {uid}
│       ├── totalPaymentsUSD  : number
│       ├── totalRefundsUSD   : number
│       ├── netRevenueUSD     : number
│       ├── paymentCount      : number
│       ├── refundCount       : number
│       └── withdrawalCount   : number
├── byPackage             : Record<PackageType, PackageStats>?
├── byCountry             : Record<countryCode, CountryStats>?
├── updatedAt             : Timestamp
└── updatedBy             : string
```

**Indexes**: `month`

---

### `paymentMethods`

Configurable list of accepted payment methods.

```
paymentMethods/{methodId}
├── id                    : string
├── name                  : string
├── active                : boolean
├── createdAt             : Timestamp
├── updatedAt             : Timestamp
├── createdBy             : string?
└── updatedBy             : string?
```

---

### `exchangeRates`

Latest currency exchange rates (single document updated periodically).

```
exchangeRates/{rateId}
├── USD                   : number           — always 1.0
├── EGP                   : number
├── JOD                   : number
├── ILS                   : number
└── [key: string]         : number           — extensible
```

---

### `loginSessions`

One document per login event.

```
loginSessions/{sessionId}
├── id                    : string
├── uid                   : string           — ref → users/{uid}
├── email                 : string
├── displayName           : string
├── role                  : Role
├── status                : SessionStatus
├── isActive              : boolean
├── loginAt               : Timestamp
├── logoutAt              : Timestamp?
├── lastSeenAt            : Timestamp
├── createdAt             : Timestamp
├── sessionDuration       : number?          — seconds
├── ipAddress             : string
├── country               : string?
├── city                  : string?
├── userAgent             : string
├── browser               : string
├── browserVersion        : string?
├── os                    : string
├── osVersion             : string?
├── device                : DeviceType
├── isSuspicious          : boolean
├── revokedAt             : Timestamp?
└── revokedBy             : string?          — ref → users/{uid}
```

**Indexes**: `uid`, `status`, `isActive`, `isSuspicious`, `loginAt`, `device`

---

### `failedLogins`

Log of failed authentication attempts.

```
failedLogins/{attemptId}
├── id                    : string
├── email                 : string?
├── ipAddress             : string
├── userAgent             : string
├── browser               : string
├── os                    : string
├── device                : DeviceType
├── reason                : string
└── attemptedAt           : Timestamp
```

**Indexes**: `email`, `ipAddress`, `attemptedAt`

---

### `activityLogs`

Team and employee activity events.

```
activityLogs/{logId}
├── id                    : string
├── type                  : ActivityLogType
│       — "team_assigned" | "team_removed" | "team_transferred"
│       | "team_deleted" | "leader_assigned" | "leader_removed" | "role_changed"
├── performedBy           : ActivityLogActor
│   ├── uid               : string
│   ├── name              : string
│   └── role              : string
├── employeeId            : string?          — ref → users/{uid}
├── employeeName          : string?
├── teamId                : string?          — ref → teams/{id}
├── teamName              : string?
├── oldTeamId             : string | null?
├── oldTeamName           : string | null?
├── newTeamId             : string | null?
├── newTeamName           : string | null?
├── oldRole               : string | null?
├── newRole               : string | null?
├── reason                : string?
├── metadata              : Record<string, unknown>?
└── createdAt             : Timestamp
```

**Indexes**: `type`, `performedBy.uid`, `employeeId`, `teamId`, `createdAt`

---

### `whatsappLeads`

WhatsApp lead prospects.

```
whatsappLeads/{leadId}
├── id                    : string
├── phone                 : string
├── name                  : string?
├── country               : string
├── countryCode           : string
├── status                : LeadStatus
├── firstMessageAt        : Timestamp
├── lastMessageAt         : Timestamp
├── lastMessagePreview    : string
├── assignedTo            : string?          — ref → users/{uid}
├── conversationStatus    : ConversationStatus?
├── unreadCount           : number?
├── notes                 : LeadNote[]?
│   └── []
│       ├── id            : string
│       ├── leadId        : string
│       ├── body          : string
│       ├── authorUid     : string
│       ├── authorName    : string
│       └── createdAt     : Timestamp
├── tags                  : string[]?
├── createdAt             : Timestamp
├── updatedAt             : Timestamp
├── createdBy             : string?
└── updatedBy             : string?
```

**Indexes**: `status`, `assignedTo`, `country`, `conversationStatus`, `lastMessageAt`

---

### `whatsappMessages`

Individual messages within a WhatsApp conversation.

```
whatsappMessages/{messageId}
├── id                    : string
├── leadId                : string           — ref → whatsappLeads/{id}
├── body                  : string
├── direction             : "inbound" | "outbound"
├── timestamp             : Timestamp
├── status                : "sent" | "delivered" | "read"
├── isInternalNote        : boolean?
├── attachmentUrl         : string?
├── attachmentType        : "image" | "file"?
└── deleted               : boolean?
```

**Indexes**: `leadId`, `direction`, `timestamp`

---

### `cannedResponses`

Pre-written WhatsApp response templates.

```
cannedResponses/{responseId}
├── id                    : string
├── title                 : string
├── body                  : string
└── createdAt             : Timestamp
```

---

## Relationships Diagram

```
users ──────────────────────────────────────────────┐
  │                                                  │
  ├── teams (leaderId → users.uid)                   │
  │      └── subscribers (assignedTeamId → teams.id)│
  │                                                  │
  ├── subscribers                                    │
  │      ├── payments (subscriberId)                 │
  │      ├── refunds (subscriberId)                  │
  │      ├── subscriberNotes (subscriberId)          │
  │      └── subscriberAssignments (subscriberId)    │
  │                                                  │
  ├── loginSessions (uid → users.uid)                │
  ├── failedLogins (email)                           │
  ├── activityLogs (performedBy.uid)                 │
  ├── auditLogs (performedBy.uid)                    │
  ├── notifications (targetUserIds / targetMinRole)  │
  └── whatsappLeads (assignedTo → users.uid) ────────┘
         └── whatsappMessages (leadId)

monthlyAnalytics  ← aggregated from payments + refunds
exchangeRates     ← standalone config
paymentMethods    ← standalone config
cannedResponses   ← standalone config
```

---

## Data Design Decisions

| Decision | Reason |
|---|---|
| Denormalized names (e.g. `assignedSalesName`) | Avoid extra reads on list views |
| `renewals[]` embedded in subscriber | Snapshot-based; no separate renewal collection needed |
| `auditLogs` is write-once | Compliance; never update or delete |
| Soft delete (`deleted + deletedAt + deletedBy`) | Data preservation and audit trail |
| `monthlyAnalytics` pre-aggregated | Avoid expensive Firestore aggregations on reports |
| `assignmentHistory[]` embedded in subscriber | Quick access to full history without joins |
| `lockedRate` stored on each subscriber/payment | Exchange rate at time of transaction; immutable for financial accuracy |

---

## Security Rules Summary

```
Owner  → full read/write on all collections
Admin  → read/write on subscribers, payments, refunds, notes, assignments
         read-only on auditLogs, loginSessions
         manage users (except owners)
Employee → read/write own assignments only
           read subscribers assigned to them
           create notes on assigned subscribers
           no access to auditLogs, users, sessions
```

---

*Schema auto-generated from TypeScript types + Firestore collections — 2026-05-20*
