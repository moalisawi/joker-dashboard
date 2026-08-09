# تحصين أمني وتشغيلي — ٢ أغسطس ٢٠٢٦

سجل جلسة مراجعة وإصلاح شاملة على `joker-dashboard` ومشروع Firebase `joker-prod`.

> **ملاحظة عن البيانات:** كل بيانات `joker-prod` وقت هذه الجلسة تجريبية للعرض، لا عملاء حقيقيين.
> ٣٠ من ٥١ مشتركاً موسومون بـ `seedSource: "fake-demo-seed"`؛ الـ٢١ الباقون **غير موسومين**،
> فسكربت `npm run clean:fake-subscribers` لن يحذفهم.

---

## ١. الاكتشاف الجذري

الملف `firestore.rules` في المستودع **لم يكن قابلاً للنشر أصلاً**.

الدالة `canReadSubscriberAsEmployee` كانت تستخدم جملة `if` داخل جسمها:

```js
function canReadSubscriberAsEmployee() {
  let hasUid = sub.get('convincedByUid', null) != null;
  if (hasUid) { return ... }        // ← غير مدعوم
  return ...
}
```

**قواعد أمان Firestore لا تدعم `if` داخل الدوال** — الدالة يجب أن تكون تعبير `return` واحداً
(مع `let` اختيارية). ثبت ذلك باختبار معزول على Firebase مباشرة:

| البنية | النتيجة |
|---|---|
| دالة بتعبير `return` واحد | ✅ |
| دالة فيها `let` | ✅ |
| دالة فيها `if` | ✗ `INVALID_ARGUMENT` |

فكل محاولة نشر كانت تُرفض برسالة غامضة، فتُرك الأمر — وبقيت قواعد **٢٢ مايو ٢٠٢٦** الأضعف
حيّة ثلاثة أشهر بينما الكود يوهم بأن الإصلاح مطبَّق.

هذا يفسّر ثلاث فجوات كانت تبدو منفصلة، وهي في الحقيقة **مجموعة تغييرات واحدة مهجورة**:

| الرجل | الحالة قبل الإصلاح |
|---|---|
| القواعد | لم تُنشر (١٨٠ سطراً منشوراً مقابل ٢٢٠ محلياً) |
| الفهارس | ٤ فهارس `convincedByUid` لم تُنشر |
| البيانات | `convincedByUid` غائب عن ٥١/٥١ مشترك و١٣/١٣ دفعة |

### ما كان مكشوفاً فعلياً

```
/subscribers   allow read: if isAnyActive();     ← أي موظف يقرأ كل المشتركين
/payments      بلا أي ربط بالمالك
/users         allow create, update: if isOwner(); ← العميل يكتب مباشرة
```

الأخيرة أخطرها: جلسة مالك كانت تستطيع الكتابة على `users/` من المتصفح متجاوزةً كل تحقق
في `/api/user-operations`.

---

## ٢. أعطال صامتة مؤكَّدة بالبيانات

### التدقيق لم يسجّل شيئاً من العميل

`services/audit.service.ts` كان يكتب على `auditLogs` بـ `addDoc`، بينما القواعد تقول
`allow write: if false`، والرفض يُبلع في `console.warn`.

الدليل من الإنتاج — إجراءات لا يسجّلها إلا العميل:

| الإجراء | سجلات | الواقع |
|---|---|---|
| `paymentMethod_created` | **٠** | ١٥ طريقة دفع موجودة |
| `team_created` | **٠** | ٤ فرق موجودة |
| `note_*` · `team_*` | **٠** | — |

**١١ من ١١ نوع إجراء عميلي: صفر سجل.** والـ٦٨ وثيقة الموجودة كلها من مسارات API الخادمية.

### الإشعارات تفشل للموظفين

`services/notification.service.ts` نفس النمط: `allow create: if isStaff()` فقط، فالإشعارات
الناتجة عن أي إجراء موظف تُسقَط بصمت. (٢١١ إشعاراً موجوداً كلها من المالكين.)

### `canAssignRole` تقبل أي قيمة

```js
if (actorRole === "owner") return true;   // بلا تحقق من assignRole
```

مع `asString(payload.newRole) as Role` في الـ route، كان `newRole: "superadmin"` يُكتب حرفياً.
لا يمنح صلاحية (لا قاعدة تطابق دوراً مجهولاً) لكنه **يجرّد الحساب من كل شيء بصمت**.

### `getDaysRemaining` تخطئ بيوم كامل

`new Date("2026-06-10")` يُفسَّر كمنتصف ليل **UTC**، بينما `today` منتصف ليل **محلي**.
في فلسطين ومصر والأردن:

| الحالة | كان | الصحيح |
|---|---|---|
| ينتهي اليوم | باقي ١ | ٠ |
| انتهى أمس | ٠ | ‎-١ |

والأثر أن الاشتراك المنتهي يبقى «ينتهي قريباً» يوماً إضافياً. لم يظهر في CI لأنه يعمل بـ UTC
حيث الحساب يصادف الصح.

### الحد المعدّلي ينفتح عند العطل

عند فشل Redis كان `checkRateLimit` يرجع `true` = اسمح بكل شيء — أي يختفي الحد من كل
المسارات بما فيها المالية، لحظة العطل بالضبط.

---

## ٣. تعارض الواجهة مع القواعد

القواعد هي مصدر الحقيقة؛ ما ترفضه القواعد يجب ألا تعرضه الواجهة، وما تسمح به يجب ألا تمنعه.

| المورد | القاعدة | الواجهة كانت | النتيجة |
|---|---|---|---|
| كتابة `teams` | `isOwner()` | `canManageUsers` (قابلة للتفويض) | أزرار تُرفض بـ permission-denied |
| قراءة `users` | `isStaff()` | `canManageUsers \|\| role==="admin"` | أزرار يردّها الخادم بـ 403 |

الالتفاف `|| role === "admin"` كان يناقض تصميم `hasServerPermission` صراحةً — وهي دالة
تُخضع الأدمن لصلاحياته الدقيقة عمداً (`DEFAULT_GRANULAR_PERMISSIONS.admin.users.manage = false`).

**ملاحظة:** `payments` لا تحمل أي حقل باسم الموظف (`subscriberId`, `subscriberName`,
`createdBy` فقط) — فمسار احتياطي بالاسم مستحيل تقنياً، وتعبئة `convincedByUid` هي الطريق الوحيد.

---

## ٤. ما نُفِّذ على الإنتاج

| العملية | النتيجة |
|---|---|
| تعبئة `convincedByUid` | ٥١/٥١ مشترك · ٩/١٣ دفعة (٤ مدفوعات مشتركوها محذوفون) |
| إنشاء الفهارس الأربعة | ٥٨/٥٨ فريد READY — مطابق للملف تماماً |
| نشر القواعد | ruleset `3095d35d-5ce3-49fc-a4f4-05251e670bb2` |

**الترتيب كان إجبارياً.** لو نُشرت القواعد قبل التعبئة لرأى كل موظف صفر مدفوعات.

### قرار حسم الأسماء المكررة

`convincedBy` اسم نصّي، ووُجد اسمان على حسابين لكلٍّ منهما. القرار (من صاحب المشروع):

| الاسم | الحساب المختار | uid |
|---|---|---|
| ميدو | موظف · `medo@joker.com` | `iyaAg2EVl9a8n75g3Gm6cG2xlfG2` |
| حنان | موظف · `hanan@joker.com` | `CNpjjqxcQQfRm8XIB9H0QgK4aSG2` |
| ميار | موظف · `mayar@joker.com` | `lFNBG0cxazdObGcaeAH4GCQBDUL2` |

المنطق: عزل `convincedByUid` موجَّه للموظفين؛ المالك يرى كل شيء بغض النظر عن الحقل.
الحسم مثبَّت في `scripts/backfill-convinced-by-uid.mjs`.

### التراجع

الكونسول ← Firestore ← Rules ← نسخة **٢٢ مايو ٢٠٢٦ · ١:٤٩ م** ← Publish.
(الـ ruleset السابق: `93be8152-d92e-4c16-b929-e8183b465f35`)

---

## ٥. تغييرات الكود

### أعطال أُصلحت
- `firestore.rules` — الدالة أُعيدت كتعبير ثلاثي واحد، مع تعليق يمنع تكرار الخطأ
- `app/api/audit-log/route.ts` *(جديد)* + `services/audit.service.ts` — الكتابة عبر Admin SDK
- `app/api/notifications/create/route.ts` *(جديد)* + `services/notification.service.ts`
- `lib/permissions.ts` — `isKnownRole()` وتحصين `canAssignRole`
- `lib/utils.ts` — `getDaysRemaining` تبني التاريخ من أجزائه محلياً، و`Math.round` لأيام التوقيت الصيفي
- `lib/rateLimit.ts` — فشل Redis يهبط للعدّاد المحلي بدل السماح المطلق

في المسارين الجديدين: **هوية المنفّذ تُؤخذ من التوكن المتحقَّق لا من جسم الطلب**، فلا يمكن نسب
عملية لغير صاحبها.

### حدود الأخطاء
`app/error.tsx` · `app/global-error.tsx` · `app/not-found.tsx` · `components/ui/ErrorScreen.tsx`

`ErrorScreen` بلا اعتماد على أي provider — لأن `global-error` يُعرض خارج الـ root layout.

### مطابقة الواجهة للقواعد
`lib/permissionGuards.ts` — حرّاس جديدة يعكس كلٌّ منها القاعدة التي يحرسها:
`canManageTeams` · `canDeleteTeams` · `canReadUserDirectory`

وفي `app/users/page.tsx` فُصلت القراءة عن الإدارة:
```ts
const canView   = canReadUserDirectory(user);        // القاعدة تسمح للأدمن
const canManage = canView && can("canManageUsers");  // الخادم يشترط users.manage
```

### تحقق المدخلات
Zod على `send-email` (صيغة كل مستلم + سقف ٥٠) · `sessions/failed` · `user-operations`
(الأدوار والحالات والأقسام كـ enums).

في `user-operations` استُخدم `z.looseObject` لا `z.object`: المخطط الصارم كان سيحذف بصمت
حقولاً تحتاجها المعالِجات.

### بنية تحتية
- `.github/workflows/ci.yml` — lint · typecheck · jest · بناء إنتاج، مع خطوة تتحقق أن ملفات
  Firebase قابلة للتحليل (منعاً لعودة عطل التعليقات)
- `firestore.indexes.json` — كان فيه ٨٣ سطر تعليق `//` يكسر `JSON.parse`؛ نُقلت الشروح إلى
  `docs/FIRESTORE_INDEXES.md` والتعريفات الستون كما هي حرفياً
- `lib/reportError.ts` *(جديد)* — نقطة تجميع واحدة، موصولة بحدَّي الأخطاء، وتُفعَّل بـ
  `NEXT_PUBLIC_ERROR_REPORT_URL`
- `lib/firebase.ts` — App Check يُفعَّل تلقائياً عند وجود `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`،
  وخامل تماماً بدونه

### الاختبارات: ١٧ ← ٨٨

| الملف | الغرض |
|---|---|
| `financial.test.ts` | تحويل العملات · السعر المثبَّت · حدود الحالات · السنة الكبيسة · الصافي مع استرجاع يتجاوز المدفوع |
| `rulesAlignment.test.ts` | كل `describe` معنون بالقاعدة التي يحرسها، مع اختبار انحدار للتفويض |
| `rateLimit.test.ts` | الهبوط عند فشل Redis · أخذ أقصى يمين `x-forwarded-for` |
| `reportError.test.ts` | لا يرمي أبداً حتى لو فشل النقل |
| `permissions.test.ts` | +٩، منها رفض دور مجهول من مالك |

اختبارات التواريخ تمر في **أربع مناطق زمنية** (القدس · UTC · نيويورك · أوكلاند) لا في واحدة.

---

## ٦. ما بقي

| البند | الحالة |
|---|---|
| تسجيل App Check | الكود جاهز — يحتاج مفتاح reCAPTCHA وقبول شروط. سجّله بوضع **المراقبة** أياماً قبل الفرض؛ الفرض قبل أن ترسل العملاء توكنات يحجب التطبيق عن بياناته |
| `UPSTASH_*` | غير مضبوطة — الحد المعدّلي per-instance |
| Sentry | `reportError` ينتظر DSN |
| ٢١ مشتركاً بلا وسم | لن يحذفهم `clean:fake-subscribers` |
| حسابات تجريبية | `asdcasc@wdf.com` (باسم «سسس») موظف **فعّال** له وصول حقيقي · و`profile`ان في `/users` بلا حساب Auth: `9eYJKe16pPeuu04RM2za7vPttpk2` و`uel0u65hLTTYlluZ7Cy7V7rO2Jc2` |
| `todayString()` | يقرأ تاريخ **UTC**. الخادم على Vercel بـ UTC، فبين منتصف الليل و٢–٣ صباحاً بتوقيت مصر/فلسطين تُسجَّل العمليات بتاريخ **الأمس**. نافذة ضيقة لكنها تمسّ تواريخ الدفع والانتهاء — قرار عمل لا إصلاح تقني |

### ٧. ما أُغلق في ٩ أغسطس ٢٠٢٦

| البند | ما صار |
|---|---|
| اختبارات `subscriber-operations` | الحسابات استُخرجت إلى `lib/subscriberFinance.ts` (نقية، بلا Firestore) و`__tests__/lib/subscriberFinance.test.ts` يغطيها بـ٥٧ اختباراً. الإجمالي ٨٨ ← ١٤٥ |
| خلل في حارس سعر الصرف | `Number(null)` و`Number("")` و`Number([])` كلها `0` وهو رقم منتهٍ، فالـ fallback في `asNumber(rate, 1)` **لا يعمل أبداً** والسعر يهبط إلى `0.000001` — أي دفعة بـ٥٠$ تُسجَّل ٥٠ مليون. غير قابل للاستغلال حالياً لأن Zod يرفض `null` قبل الوصول، لكن الحارس أُصلح في `normalizeExchangeRate` بدل الاعتماد على طبقة فوقه |
| حساب التواريخ | `addDays`/`daysUsed`/`remainingDays` كانت تخلط `new Date("YYYY-MM-DD")` (منتصف ليل UTC) مع `setDate`/`getDate` (محلي) — صحيحة في UTC وخاطئة بيوم غربه. أُعيدت كحساب UTC خالص، والاختبارات تمر في أربع مناطق زمنية |
| `unsafe-eval` في الإنتاج | كان يُشحن في `script-src` على الإنتاج، وهو تحديداً ما تمنعه سياسة CSP. صار مقصوراً على التطوير (يحتاجه React Refresh وحده)، وتُحقِّق منه صفحة إنتاج حقيقية بلا أخطاء كونسول |
| `images.domains` | محذوف في Next 16 وكان يحمل `cdn.example.com` — استُبدل بـ`remotePatterns` لنطاقات Firebase Storage |
| السجل الاختباري | `failedLogins/AR2dQOUzWH9hEnrFl51P` حُذف |

### تنبيه للتحقق

المالك يرى كل شيء ولن يلاحظ فرقاً. **اختبر بحساب موظف** (`medo@joker.com` أو
`hanan@joker.com`): يجب أن تعرض قائمة المشتركين ١٩ أو ١٦ لا ٥١، وأن تفتح الصفحات بلا
أخطاء صلاحيات.
