# نظام الجوكر — Data Schema

> مرجع كامل لهيكل بيانات Firebase Firestore لكل collection في النظام.

---

## فهرس المجموعات (Collections)

| المجموعة | الغرض | الأولوية |
|---|---|---|
| [`subscribers`](#1-subscribers) | المشتركون الرئيسيون | ⭐ Critical |
| [`users`](#2-users) | المستخدمون (موظفون + مدراء + مالك) | ⭐ Critical |
| [`payments`](#3-payments) | معاملات الدفع | ⭐ Critical |
| [`refunds`](#4-refunds) | معاملات الاسترداد | High |
| [`auditLogs`](#5-auditlogs) | سجل العمليات | High |
| [`notifications`](#6-notifications) | إشعارات التطبيق | High |
| [`loginSessions`](#7-loginsessions) | جلسات تسجيل الدخول | High |
| [`failedLogins`](#8-failedlogins) | محاولات الدخول الفاشلة | Medium |
| [`teams`](#9-teams) | الفرق | Medium |
| [`subscriberNotes`](#10-subscribernotes) | ملاحظات داخلية على المشتركين | Medium |
| [`activityLogs`](#11-activitylogs) | سجل تغييرات الفرق والموظفين | Medium |
| [`monthlyAnalytics`](#12-monthlyanalytics) | تحليلات شهرية محسوبة مسبقاً | Medium |
| [`paymentMethods`](#13-paymentmethods) | طرق الدفع المتاحة | Low |
| [`exchangeRates`](#14-exchangerates) | أسعار الصرف | Low |
| [`whatsappLeads`](#15-whatsappleads) | عملاء WhatsApp | Low |
| [`whatsappMessages`](#16-whatsappmessages) | رسائل WhatsApp | Low |
| [`cannedResponses`](#17-cannedresponses) | ردود جاهزة | Low |

---

## أنواع مشتركة (Shared Types)

```typescript
type Currency       = "USD" | "EGP" | "JOD" | "ILS"
type PackageType    = "فضية" | "ذهبية"
type Role           = "owner" | "admin" | "employee"
type AccountStatus  = "active" | "suspended" | "disabled" | "pending"
type DeviceType     = "desktop" | "mobile" | "tablet"

// Timestamp = Firebase Firestore Timestamp
```

### BaseDocument (حقول مشتركة في كل document)
```typescript
{
  id:         string       // Firestore document ID
  createdAt:  Timestamp
  updatedAt:  Timestamp
  createdBy?: string       // uid
  updatedBy?: string       // uid
  deleted?:   boolean      // soft-delete flag
  deletedAt?: Timestamp
  deletedBy?: string       // uid
}
```

---

## 1. `subscribers`

المجموعة الرئيسية. كل document = مشترك واحد.

### حالات المشترك

| القيمة | العرض | اللون |
|---|---|---|
| `"نشط"` | نشط | `#83A2DB` |
| `"ينتهي قريباً"` | ينتهي قريباً | `#E8B570` |
| `"منتهي"` | منتهي | `#CE6969` |
| `"منسحب"` | مسحوب | `#94A3B8` |
| `"موقوف"` | موقوف | `#E8B570` |
| `"متجمد"` | مجمّد | `#9DB4D6` |

### Schema

```typescript
{
  // ── هوية المشترك ───────────────────────────────────────────────────────────
  id:            string           // Firestore doc ID
  name:          string
  phone:         string
  dialCode:      string           // e.g. "+20"
  phoneCountry:  string           // ISO code, e.g. "EG"
  residence:     string
  age?:          number | null

  // ── الاشتراك ───────────────────────────────────────────────────────────────
  package:       PackageType      // "فضية" | "ذهبية"
  duration:      number           // بالأشهر
  date:          string           // YYYY-MM-DD (تاريخ الاشتراك)
  startDate?:    string           // YYYY-MM-DD
  expiryDate:    string           // YYYY-MM-DD
  daysRemaining: number

  status:               SubscriberStatus    // "نشط" | "ينتهي قريباً" | ...
  subscriptionStatus?:  SubscriptionStatus  // "active" | "paused" | "expired" | "withdrawn" | "frozen"
  subscriptionState:    SubscriptionState   // "active" | "withdrawn"

  // ── التسعير ────────────────────────────────────────────────────────────────
  currencyOriginal:   Currency
  currency:           Currency
  lockedRate:         number        // سعر الصرف وقت الاشتراك
  totalPrice:         number        // بالعملة الأصلية
  totalPriceUSD:      number
  paidAmount:         number
  paidAmountUSD:      number
  remainingAmount:    number
  remainingAmountUSD: number
  netAmountUSD:       number

  // ── مصدر المشترك ──────────────────────────────────────────────────────────
  payment:      string             // طريقة الدفع
  source:       string             // مصدر الاشتراك
  referrer?:    string
  convincedBy:  string             // uid الموظف
  paidShift:    string
  team:         string
  notes?:       string

  // ── نظام الإيقاف المؤقت ───────────────────────────────────────────────────
  pausedAt?:              Timestamp | null
  pausedBy?:              string | null       // uid
  pauseReason?:           string | null
  remainingDaysAtPause?:  number | null
  totalPausedDays?:       number

  // ── نظام التجميد ──────────────────────────────────────────────────────────
  freezeData?: {
    isFrozen:            boolean
    frozenAt:            Timestamp | null
    frozenBy:            string | null        // uid
    freezeReason?:       string
    freezeNotes?:        string
    originalExpiryDate:  string | null        // YYYY-MM-DD
    remainingDays:       number
    resumedAt:           Timestamp | null
    resumedBy:           string | null        // uid
  }

  // ── نظام الانسحاب ─────────────────────────────────────────────────────────
  withdrawalDate?:   Timestamp | null
  withdrawalReason?: string
  withdrawnAt?:      string
  withdrawalData?: {
    withdrawnAt:         Timestamp
    withdrawnBy:         string
    withdrawnByName:     string
    withdrawalReason:    string
    notes?:              string
    refundIssued:        boolean
    refundId?:           string
    refundAmount?:       number
    refundCurrency?:     Currency
    refundAmountUSD?:    number
    exchangeRate?:       number
    originalPlan:        string
    originalExpiryDate:  string
    previousStatus:      string
    activeDaysUsed:      number
    remainingDays:       number
  }

  // ── دورة حياة التجديد ─────────────────────────────────────────────────────
  renewals:          RenewalSnapshot[]  // snapshot لكل فترة اشتراك سابقة
  renewalCount:      number
  lifetimeValueUSD:  number
  lastRenewalDate?:  Timestamp | null

  // RenewalSnapshot (داخل renewals[])
  // {
  //   package:           PackageType
  //   startDate:         string
  //   endDate:           string
  //   duration:          number
  //   totalPrice:        number
  //   totalPriceUSD:     number
  //   paidAmountUSD:     number
  //   remainingAmountUSD:number
  //   netAmountUSD:      number
  //   currency:          Currency
  //   lockedRate:        number
  //   payment:           string
  //   convincedBy:       string
  //   paidShift:         string
  //   snapshotStatus:    "active" | "withdrawn" | "expired"
  //   renewedAt:         Timestamp | null
  //   renewedBy:         string
  //   renewedByName:     string
  // }

  // ── Workflow (نظام المتابعة) ───────────────────────────────────────────────
  workflowStatus?:          WorkflowStatus
  // "new" | "interested" | "follow_up" | "awaiting_payment" |
  // "active" | "paused" | "completed" | "cancelled" | "refunded"

  workflowStatusChangedAt?: Timestamp
  workflowStatusChangedBy?: string       // uid
  workflowStatusNote?:      string

  // تجديد Workflow
  renewalWorkflowStatus?:   RenewalWorkflowStatus
  // "pending" | "contacted" | "renewed" | "declined"
  renewalSuggestedBy?:      string | null
  renewalSuggestedByName?:  string | null
  renewalHandledBy?:        string | null
  renewalHandledByName?:    string | null
  renewalNote?:             string

  // ── التعيينات ──────────────────────────────────────────────────────────────
  assignedSalesId?:          string | null
  assignedSalesName?:        string | null
  assignedNutritionistId?:   string | null
  assignedNutritionistName?: string | null
  assignedTeamId?:           string | null
  assignedTeamName?:         string | null
  assignmentType?:           AssignmentType
  // "sales" | "nutrition" | "owner" | "unassigned"

  assignmentHistory?: AssignmentHistoryEntry[]
  // {
  //   assignedSalesId?:          string | null
  //   assignedSalesName?:        string | null
  //   assignedNutritionistId?:   string | null
  //   assignedNutritionistName?: string | null
  //   assignedTeamId?:           string | null
  //   assignedTeamName?:         string | null
  //   assignmentType:            AssignmentType
  //   actorId:                   string
  //   actorName:                 string
  //   reason?:                   string
  //   timestamp:                 Timestamp
  // }

  // ── Meta ───────────────────────────────────────────────────────────────────
  createdAt?:  Timestamp
  createdBy?:  string    // uid
  updatedAt?:  Timestamp
  updatedBy?:  string    // uid

  // حقول legacy (للتوافق مع بيانات قديمة — لا تُستخدم في الكود الجديد)
  isRenewal?:          boolean
  renewalOf?:          string
  isUpgrade?:          boolean
  isDowngrade?:        boolean
  originalTeam?:       string
  originalConvincedBy?:string
  renewedBy?:          string
  refundAmount?:       number
  refundAmountUSD?:    number
  refundCurrency?:     Currency
  refundRate?:         number
}
```

---

## 2. `users`

المستخدمون الكاملون: مالك + مدراء + موظفون.

### الأدوار

| الدور | المعنى | اللون |
|---|---|---|
| `"owner"` | مالك — صلاحيات كاملة | `#10141A` |
| `"admin"` | مدير — إدارة بدون حذف/مستخدمين | `#83A2DB` |
| `"employee"` | موظف — عمليات محدودة | `#64748B` |

### Schema

```typescript
{
  uid:          string        // Firebase Auth UID = document ID
  email:        string
  name:         string
  employeeName?: string
  role:         Role           // "owner" | "admin" | "employee"

  // ── حقول الموظف ────────────────────────────────────────────────────────────
  isEmployee?:    boolean
  employeeRole?:  EmployeeRole
  // "sales" | "followup" | "team_leader" | "admin" | "owner"

  department?:    EmployeeDepartment
  // "مبيعات" | "متابعة" | "إدارة" | "أخرى"

  notes?:         string
  phone?:         string
  teamId?:        string

  // ── حالة الحساب ────────────────────────────────────────────────────────────
  status?:  AccountStatus   // "active" | "suspended" | "disabled" | "pending"
  active:   boolean         // legacy — يُحسب من status

  // ── صلاحيات مخصصة (تُلغي defaults الدور) ──────────────────────────────────
  granularPermissions?: {
    subscribers: {
      view:         boolean
      create:       boolean
      edit:         boolean
      delete:       boolean
      assign?:      boolean
      transfer?:    boolean
      changeStatus?: boolean
      viewNotes?:   boolean
      addNotes?:    boolean
    }
    subscriptions: {
      renew:           boolean
      freeze:          boolean
      resume:          boolean
      withdraw:        boolean
      manageRenewals?: boolean
    }
    payments: {
      create:  boolean
      edit:    boolean
      refund:  boolean
    }
    analytics: {
      view:    boolean
      export:  boolean
    }
    logs: {
      view:    boolean
    }
    users: {
      manage:           boolean
      changeRoles:      boolean
      activateAccounts: boolean
    }
    settings: {
      manage:  boolean
    }
  }

  // ── Meta ───────────────────────────────────────────────────────────────────
  deleted?:    boolean
  deletedAt?:  string | Timestamp
  deletedBy?:  string
  createdAt?:  Timestamp
  createdBy?:  string
  updatedAt?:  Timestamp
  updatedBy?:  string
  lastLoginAt?:Timestamp
}
```

---

## 3. `payments`

معاملات الدفع — immutable بعد الإنشاء.

### أنواع الدفع

| النوع | المعنى |
|---|---|
| `"initial"` | دفعة أولى عند الاشتراك |
| `"installment"` | قسط من اشتراك قائم |
| `"renewal"` | دفعة تجديد |
| `"refund"` | استرداد (تأثير سالب) |

### Schema

```typescript
{
  id:              string       // Firestore doc ID

  subscriberId:    string
  subscriberName:  string

  amountOriginal:  number       // بالعملة الأصلية
  currencyOriginal:Currency
  exchangeRate:    number       // سعر الصرف وقت الدفع
  amountUSD:       number

  paymentMethod:   string
  paymentMethodId?: string
  paymentType?:    PaymentType  // "initial" | "installment" | "renewal" | "refund"

  date:            string       // YYYY-MM-DD
  notes?:          string | null

  receiptUrl?:     string | null
  receiptType?:    string | null

  isInitialPayment:  boolean
  isRenewalPayment:  boolean
  renewalNumber?:    number

  createdAt:  Timestamp
  createdBy:  string    // uid
}
```

---

## 4. `refunds`

معاملات الاسترداد — immutable، دائماً تأثير سالب على الإيرادات.

```typescript
{
  id?:              string       // Firestore doc ID

  subscriberId:     string
  subscriberName:   string

  refundAmount:     number
  refundCurrency:   Currency
  exchangeRate:     number
  refundAmountUSD:  number

  refundDate:       string       // YYYY-MM-DD
  refundReason:     string
  notes?:           string

  relatedWithdrawalId?: string
  isWithdrawalRefund?:  boolean

  financialImpact:  "negative"  // ثابت دائماً

  createdAt:       Timestamp
  createdBy:       string       // uid
  createdByName?:  string
}
```

---

## 5. `auditLogs`

سجل كامل لكل عملية في النظام.

### التصنيفات والخصائص

| الفئة | الاستخدام |
|---|---|
| `"subscriber"` | إنشاء/تعديل/حذف مشترك |
| `"financial"` | دفع/استرداد |
| `"user"` | إدارة المستخدمين |
| `"auth"` | تسجيل دخول/خروج |
| `"system"` | عمليات تلقائية |
| `"whatsapp"` | نشاط WhatsApp |

| الخطورة | الاستخدام |
|---|---|
| `"info"` | عمليات اعتيادية |
| `"success"` | إتمام عملية ناجحة |
| `"warning"` | تغييرات حساسة |
| `"critical"` | حذف/تعليق/أنشطة مشبوهة |

### Schema

```typescript
{
  id:         string

  action:     string            // اسم العملية، e.g. "subscriber_created"
  category?:  AuditCategory     // "subscriber" | "financial" | "user" | "auth" | "system" | "whatsapp"
  severity?:  AuditSeverity     // "info" | "success" | "warning" | "critical"
  source?:    AuditSource       // "dashboard" | "system" | "api"
  status?:    "completed" | "failed" | "pending"

  entityType?:  string           // "subscriber" | "user" | "payment" ...
  entityId?:    string
  entityName?:  string

  description?:    string
  previousData?:   Record<string, unknown>
  newData?:        Record<string, unknown>
  changedFields?:  string[]

  performedBy?: {
    uid:    string
    name:   string
    email:  string
    role:   string
  }

  targetUser?: {
    uid?:   string
    name?:  string
    role?:  string
  }

  financialData?: {
    amount?:      number
    currency?:    string
    amountUSD?:   number
    impactType?:  "positive" | "negative" | "neutral"
  }

  tags?:      string[]
  metadata?:  Record<string, unknown>
  createdAt?: Timestamp
}
```

---

## 6. `notifications`

إشعارات التطبيق الداخلية.

### أنواع الإشعارات

| النوع | الحدث |
|---|---|
| `subscription_expiring` | اشتراك سينتهي قريباً |
| `subscription_expired` | اشتراك انتهى |
| `renewal_created` | تجديد ناجح |
| `subscription_frozen` | تجميد اشتراك |
| `withdrawal_created` | انسحاب مشترك |
| `refund_created` | استرداد جديد |
| `revenue_drop` | انخفاض مفاجئ في الإيرادات |
| `login_failed` | محاولة دخول فاشلة |
| `suspicious_activity` | نشاط مشبوه |
| `role_changed` | تغيير دور مستخدم |
| `account_suspended` | تعليق حساب |

### Schema

```typescript
{
  id:           string
  type:         NotificationType  // النوع أعلاه
  category:     NotificationCategory  // "operational" | "financial" | "security" | "user" | "insight"
  title:        string
  description:  string
  severity:     NotificationSeverity  // "info" | "success" | "warning" | "critical"

  readBy:    string[]   // UIDs من قرأ الإشعار
  archived:  boolean

  actionUrl?:   string   // رابط الإجراء

  entityType?:  string
  entityId?:    string
  entityName?:  string

  performedBy?: {
    uid:   string
    name:  string
    role:  string
  }

  financialData?: {
    amount?:    number
    currency?:  string
    amountUSD?: number
  }

  metadata?:  Record<string, unknown>

  targetMinRole:   NotificationMinRole   // "employee" | "admin" | "owner"
  targetUserIds?:  string[]              // UIDs محددة تستقبل الإشعار

  createdAt:   Timestamp
  expiresAt?:  Timestamp
}
```

---

## 7. `loginSessions`

كل جلسة تسجيل دخول ناجحة.

```typescript
{
  id:           string
  uid:          string
  email:        string
  displayName:  string
  role:         Role

  status:    SessionStatus   // "active" | "logged_out" | "expired" | "suspicious"
  isActive:  boolean

  loginAt:      Timestamp
  logoutAt?:    Timestamp
  lastSeenAt:   Timestamp
  createdAt:    Timestamp

  sessionDuration?: number   // بالثواني — يُضبط عند الخروج

  ipAddress:  string
  country?:   string
  city?:      string

  userAgent:        string
  browser:          string
  browserVersion?:  string
  os:               string
  osVersion?:       string
  device:           DeviceType

  isSuspicious:  boolean
  revokedAt?:    Timestamp
  revokedBy?:    string      // uid
}
```

---

## 8. `failedLogins`

محاولات تسجيل الدخول الفاشلة.

```typescript
{
  id:           string
  email?:       string
  ipAddress:    string
  userAgent:    string
  browser:      string
  os:           string
  device:       DeviceType
  reason:       string
  attemptedAt:  Timestamp
}
```

---

## 9. `teams`

الفرق التشغيلية (مبيعات / متابعة).

```typescript
{
  // extends BaseDocument
  id:          string
  createdAt:   Timestamp
  updatedAt:   Timestamp
  createdBy?:  string
  updatedBy?:  string
  deleted?:    boolean
  deletedAt?:  Timestamp
  deletedBy?:  string

  name:          string
  type:          TeamType      // "sales" | "nutrition"
  active:        boolean
  membersCount:  number        // يُحدَّث transactionally
  leaderId:      string | null // uid قائد الفريق
  description:   string | null
}
```

---

## 10. `subscriberNotes`

ملاحظات داخلية على المشتركين.

### أنواع الملاحظات

| النوع | المعنى |
|---|---|
| `"sales"` | ملاحظة مبيعات |
| `"nutrition"` | ملاحظة تغذية |
| `"renewal"` | ملاحظة تجديد |
| `"payment"` | ملاحظة دفع |
| `"general"` | عامة |

```typescript
{
  id:              string
  subscriberId:    string
  subscriberName?: string
  authorId:        string      // uid
  authorName:      string
  content:         string
  noteType:        NoteType
  deleted?:        boolean
  deletedAt?:      Timestamp
  deletedBy?:      string
  createdAt:       Timestamp
  updatedAt:       Timestamp
}
```

---

## 11. `activityLogs`

سجل تغييرات تخصيص الموظفين والفرق.

### الأنواع

| النوع | الحدث |
|---|---|
| `team_assigned` | موظف أُضيف لفريق |
| `team_removed` | موظف أُزيل من فريق |
| `team_transferred` | موظف نُقل بين فريقين |
| `team_deleted` | فريق كامل حُذف |
| `leader_assigned` | تعيين قائد فريق |
| `leader_removed` | إزالة قائد فريق |
| `role_changed` | تغيير الدور الوظيفي |

```typescript
{
  id:    string
  type:  ActivityLogType

  performedBy: {
    uid:   string
    name:  string
    role:  string
  }

  employeeId?:    string
  employeeName?:  string

  teamId?:    string
  teamName?:  string

  oldTeamId?:    string | null
  oldTeamName?:  string | null
  newTeamId?:    string | null
  newTeamName?:  string | null

  oldRole?:  string | null
  newRole?:  string | null

  reason?:    string
  metadata?:  Record<string, unknown>
  createdAt:  Timestamp
}
```

---

## 12. `monthlyAnalytics`

بيانات محسوبة مسبقاً لتسريع لوحة التحليلات.

```typescript
{
  id?:     string    // YYYY-MM (document ID)
  month:   string    // YYYY-MM

  totalPaymentsUSD:  number
  totalRefundsUSD:   number
  netRevenueUSD:     number
  paymentCount:      number
  refundCount:       number
  withdrawalCount:   number

  byEmployee?: Record<string, {
    totalPaymentsUSD:  number
    totalRefundsUSD:   number
    netRevenueUSD:     number
    paymentCount:      number
    refundCount:       number
    withdrawalCount:   number
  }>

  byPackage?: Record<PackageType, {
    totalPaymentsUSD:  number
    totalRefundsUSD:   number
    netRevenueUSD:     number
    paymentCount:      number
    refundCount:       number
    withdrawalCount:   number
  }>

  byCountry?: Record<string, {
    totalPaymentsUSD:  number
    totalRefundsUSD:   number
    netRevenueUSD:     number
    paymentCount:      number
    refundCount:       number
    withdrawalCount:   number
  }>

  updatedAt:  Timestamp
  updatedBy:  string
}
```

---

## 13. `paymentMethods`

طرق الدفع التي يمكن للمشتركين الدفع بها.

```typescript
{
  id:      string
  name:    string     // اسم طريقة الدفع
  active:  boolean
  order?:  number     // ترتيب العرض
}
```

---

## 14. `exchangeRates`

أسعار صرف العملات (document واحد: `"current"`).

```typescript
{
  USD:  number   // = 1
  EGP:  number   // كم EGP يساوي 1 USD
  JOD:  number
  ILS:  number
  [key: string]: number

  updatedAt?: Timestamp
  updatedBy?: string
}
```

---

## 15. `whatsappLeads`

عملاء WhatsApp قبل التحويل إلى مشتركين.

```typescript
{
  id:           string
  phone:        string
  name?:        string
  status:       string    // "new" | "contacted" | "converted" | "rejected"
  assignedTo?:  string    // uid الموظف
  notes?:       string
  createdAt:    Timestamp
  updatedAt:    Timestamp
}
```

---

## 16. `whatsappMessages`

رسائل WhatsApp المرسلة/المستقبَلة.

```typescript
{
  id:        string
  leadId:    string     // ref → whatsappLeads
  direction: "inbound" | "outbound"
  content:   string
  type:      "text" | "image" | "document"
  sentBy?:   string     // uid
  sentAt:    Timestamp
}
```

---

## 17. `cannedResponses`

ردود جاهزة لـ WhatsApp.

```typescript
{
  id:      string
  title:   string
  content: string
  tags?:   string[]
  active:  boolean
  createdBy?: string
  createdAt:  Timestamp
}
```

---

## علاقات البيانات (Relationships)

```
subscribers
  ├─ payments[]          (subscriberId → payments.subscriberId)
  ├─ refunds[]           (subscriberId → refunds.subscriberId)
  ├─ subscriberNotes[]   (subscriberId → subscriberNotes.subscriberId)
  ├─ auditLogs[]         (entityId → auditLogs.entityId)
  └─ notifications[]     (entityId → notifications.entityId)

users
  ├─ loginSessions[]     (uid → loginSessions.uid)
  ├─ auditLogs[]         (performedBy.uid)
  └─ teams               (teamId → teams.id)

teams
  ├─ users[]             (teamId → users.teamId)
  └─ activityLogs[]      (teamId → activityLogs.teamId)

whatsappLeads
  └─ whatsappMessages[]  (leadId → whatsappMessages.leadId)
```

---

## قواعد الأمان (Security Rules — ملخص)

| المجموعة | owner | admin | employee |
|---|---|---|---|
| `subscribers` | CRUD | CRU | CR (محدود) |
| `users` | CRUD | R | R (نفسه فقط) |
| `payments` | CRUD | CR | CR |
| `refunds` | CRUD | CR | — |
| `auditLogs` | R | R | — |
| `notifications` | CRUD | CRU | R |
| `loginSessions` | CRUD | R | R (نفسه) |
| `teams` | CRUD | R | R |
| `monthlyAnalytics` | R | R | — |

---

*آخر تحديث: 2026-05-20 — مُولَّد من كود المشروع + DESIGN.md*
