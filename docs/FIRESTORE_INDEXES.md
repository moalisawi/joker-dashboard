# فهارس Firestore — الشرح المرجعي

> ملف `firestore.indexes.json` **يجب أن يبقى JSON صالحاً** (بدون تعليقات `//`).
> كان يحتوي على ٨٣ سطر تعليق، فكان `JSON.parse` يفشل عليه وأي سكربت أو خطوة CI
> تقرأ الملف تنكسر. نُقلت الشروح إلى هنا وبقيت تعريفات الفهارس كما هي حرفياً.
>
> **٦٠ فهرساً مركّباً** موزّعة كالتالي:
> `subscribers` ١٣ · `payments` ١١ · `whatsappLeads` ٨ · `auditLogs` ٦ ·
> `refunds` ٥ · `notifications` ٤ · `paymentMethods` ٣ · `activityLogs` ٣ ·
> `users` ٢ · `subscriberAssignments` ٢ · `teams` ١ · `whatsappMessages` ١ ·
> `cannedResponses` ١

عند إضافة فهرس جديد: عدّل `firestore.indexes.json` (JSON نقي) ثم أضف سطر شرح هنا.

---

## payments

| الحقول | الغرض |
|---|---|
| `subscriberId` ↑ · `createdAt` ↓ | سجل مدفوعات المشترك (المودال، الـ timeline) |
| `subscriberId` ↑ · `date` ↓ | سجل مدفوعات المشترك — مرتّب بالتاريخ (صفحة الملف) |
| `date` ↑ · `amountUSD` ↓ | التقرير المالي الشهري: تصفية بمدى تاريخي وترتيب بالمبلغ |
| `createdBy` ↑ · `date` ↓ | أداء الموظف (المسار القديم المعتمد على الاسم) |
| `convincedByUid` ↑ · `date` ↓ | تحليلات مدفوعات الموظف (النطاق الجديد بالـ UID من firestore.rules) |
| `convincedByUid` ↑ · `date` ↑ | نفس السابق مع مدى تاريخي — المرشّح النطاقي يفرض ترتيباً تصاعدياً |
| `paymentMethod` ↑ · `date` ↓ | توزيع طرق الدفع |
| `isRenewalPayment` ↑ · `date` ↓ | تحليلات التجديد |
| `subscriberId` ↑ · `renewalNumber` ↑ · `createdAt` ↓ | مدفوعات المشترك حسب رقم التجديد (تتبّع الأقساط) |
| `paymentMethodId` ↑ · `date` ↓ | استعلامات رصيد طريقة الدفع — ترتيب تنازلي للعرض الزمني |
| `paymentMethodId` ↑ · `date` ↑ | مرشّح نطاقي (`date >= periodStart`) يتطلب تصاعدياً — يستخدمه مودال الدافعين |

## refunds

| الحقول | الغرض |
|---|---|
| `subscriberId` ↑ · `createdAt` ↓ | سجل استرجاعات المشترك |
| `subscriberId` ↑ · `refundDate` ↓ · `__name__` ↑ | سجل الاسترجاعات بمدى تاريخي مرتّباً تنازلياً |
| `subscriberId` ↑ · `refundDate` ↓ · `__name__` ↓ | نفس الاستعلام لكن مؤشّر Firestore يستخدم `__name__` تنازلياً (نسخة الـ snapshot listener) |
| `refundDate` ↑ · `refundAmountUSD` ↓ | إجماليات الاسترجاع الشهرية |
| `createdBy` ↑ · `refundDate` ↓ | تقرير الاسترجاع لكل موظف |

## auditLogs

| الحقول | الغرض |
|---|---|
| `actorUid` ↑ · `createdAt` ↓ | خلاصة نشاط المستخدم |
| `targetType` ↑ · `targetId` ↑ · `createdAt` ↓ | تاريخ كيان معيّن (كل سجلات مشترك مثلاً) |
| `action` ↑ · `createdAt` ↓ | تصفية بنوع الإجراء مرتّبة زمنياً |
| `action` ↑ · `createdAt` ↑ | لـ `checkFailedLogins` في alert-engine: `action == "login_failed"` مع `createdAt >= hourAgo`. المرشّح النطاقي يفرض ترتيب `createdAt` تصاعدياً فيحتاج فهرساً مركّباً خاصاً به |
| `actorRole` ↑ · `createdAt` ↓ | مراجعة التدقيق حسب الدور |
| `actorUid` ↑ · `action` ↑ · `createdAt` ↓ | تحقيق تدقيقي مفصّل: الإجراء + المنفّذ |

## notifications

| الحقول | الغرض |
|---|---|
| `archived` ↑ · `createdAt` ↓ | خلاصة الإشعارات: غير المؤرشف أولاً، الأحدث أولاً |
| `targetMinRole` ↑ · `archived` ↑ · `createdAt` ↓ | خلاصة موجّهة حسب الدور |
| `type` ↑ · `createdAt` ↓ | تصفية بنوع الإشعار |
| `type` ↑ · `archived` ↑ · `createdAt` ↓ | فحص التكرار في `notification.service.ts`: `type == x` + `archived == false` + `createdAt > twelveHoursAgo` + `limit(1)` |

## users

| الحقول | الغرض |
|---|---|
| `isEmployee` ↑ · `name` ↑ | قائمة الموظفين مرتّبة بالاسم |
| `isEmployee` ↑ · `active` ↑ · `name` ↑ | قائمة الموظفين النشطين |

## paymentMethods

| الحقول | الغرض |
|---|---|
| `deleted` ↑ · `name` ↑ | `getAll()`: `where(deleted != true).orderBy(name)` |
| `status` ↑ · `country` ↑ · `name` ↑ | تصفية بالحالة والدولة |
| `deleted` ↑ · `status` ↑ · `name` ↑ | تصفية مركّبة بالحالة مع استبعاد المحذوف |

## subscribers

| الحقول | الغرض |
|---|---|
| `deleted` ↑ · `createdAt` ↓ | `getAll()`: `where(deleted != true)` — المرشّح غير المتساوي يتطلب فهرساً |
| `deleted` ↑ · `date` ↓ | `where(deleted != true)` + `orderBy(date)` |
| `subscriptionState` ↑ · `date` ↓ | لوحة الحالات |
| `convincedBy` ↑ · `date` ↓ | تقرير إسناد الموظف (القديم بالاسم) |
| `convincedByUid` ↑ · `createdAt` ↓ | استعلام الموظف المحدود النطاق (الجديد بالـ UID) — `useSubscribers` |
| `convincedByUid` ↑ · `deleted` ↑ · `createdAt` ↓ | نفس السابق مع استبعاد المحذوف |
| `residence` ↑ · `date` ↓ | التوزيع حسب الدولة/الإقامة |
| `package` ↑ · `date` ↓ | تحليل نوع الباقة |
| `status` ↑ · `updatedAt` ↓ | المشتركون المعدَّلون حديثاً (لوحة الإدارة) |
| `convincedBy` ↑ · `subscriptionState` ↑ · `date` ↓ | الموظف + الحالة: كم أقنع من نشط/منسحب |
| `subscriptionState` ↑ · `endDate` ↑ | الترتيب بتاريخ الانتهاء لتنبيهات التجديد |
| `subscriptionState` ↑ · `expiryDate` ↑ | `checkExpiringSubscriptions` وتنبيه الانتهاء في notification.service: `subscriptionState == "active"` + `expiryDate >= today` + `expiryDate <= in3Days` |
| `subscriptionState` ↑ · `updatedAt` ↑ | `checkWithdrawalSpike`: `subscriptionState == "withdrawn"` + `updatedAt >= x` |

## teams

| الحقول | الغرض |
|---|---|
| `active` ↑ · `deleted` ↑ | `teamsService.getActive()`: `where(active == true)` + `where(deleted != true)`. Firestore يتطلب فهرساً مركّباً عند خلط مرشّح تساوٍ مع مرشّح عدم تساوٍ على حقلين مختلفين — و`!=` يفرض ترتيباً ضمنياً على `deleted` |

## activityLogs

| الحقول | الغرض |
|---|---|
| `employeeId` ↑ · `createdAt` ↓ | `activityLog.service.ts` — `getByEmployee` |
| `teamId` ↑ · `createdAt` ↓ | `getByTeam` |
| `type` ↑ · `createdAt` ↓ | `getByType` |

## subscriberAssignments

| الحقول | الغرض |
|---|---|
| `subscriberId` ↑ · `createdAt` ↓ | `assignment.service.ts` — `getHistoryBySubscriberId` |
| `transferredBy` ↑ · `createdAt` ↓ | `getHistoryByEmployee` |

## whatsappLeads

| الحقول | الغرض |
|---|---|
| `deleted` ↑ · `lastMessageAt` ↓ | القائمة الرئيسية: `excludeDeleted()` + `orderBy(lastMessageAt desc)` |
| `deleted` ↑ · `lastMessageAt` ↑ | قائمة بمدى تاريخي — المرشّح النطاقي يفرض التصاعدي |
| `deleted` ↑ · `status` ↑ · `lastMessageAt` ↓ | تصفية بالحالة |
| `deleted` ↑ · `country` ↑ · `lastMessageAt` ↓ | تصفية بالدولة |
| `deleted` ↑ · `assignedTo` ↑ · `lastMessageAt` ↓ | تصفية بالإسناد |
| `deleted` ↑ · `conversationStatus` ↑ · `lastMessageAt` ↓ | تصفية بحالة المحادثة |
| `deleted` ↑ · `phone` ↑ · `createdAt` ↓ | البحث في سجل المحادثات برقم الهاتف |
| `deleted` ↑ · `lastMessageAt` ↑ | التحليلات الشهرية: مدى تاريخي على `lastMessageAt` |

## whatsappMessages

| الحقول | الغرض |
|---|---|
| `leadId` ↑ · `deleted` ↑ · `timestamp` ↑ | تحميل رسائل عميل محتمل: `where(leadId)` + `where(deleted == false)` + `orderBy(timestamp)` |

## cannedResponses

| الحقول | الغرض |
|---|---|
| `deleted` ↑ · `createdAt` ↑ | قائمة الردود الجاهزة |

---

## fieldOverrides

المصفوفة فارغة حالياً. كانت تحمل ملاحظة فقط (بلا أي تجاوز فعلي):

> كان مقترحاً تعطيل الفهرس المفرد الافتراضي على `monthlyAnalytics.month` لأن معرّف
> الوثيقة **هو** الشهر نفسه، فلا حاجة لفهرس حقل منفصل. لم يُطبَّق التجاوز فعلياً.
> أضِفه إذا استحدثت حقل `month` منفصلاً وبدأت تستعلم عنه.
