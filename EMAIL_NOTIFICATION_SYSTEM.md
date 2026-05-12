# وثائق نظام الإشعارات البريدية

## نظرة عامة

هذا المشروع يحتوي على بنية بريدية مهيكلة باستخدام `Resend` وNext.js App Router. الهدف هو تقديم بنية قابلة للتوسع لإرسال إشعارات بريدية آمنة للعمليات، المالية، الأمان، ومتابعة الاشتراكات.

النظام مبني على:
- `services/email.service.ts` كخدمة مركزية لإرسال البريد من الخادم فقط
- قوالب HTML لكل نوع إشعار داخل مجلد `emails/`
- واجهة اختبار بريدية `app/api/test-email/route.ts`
- واجهة إرسال بريد عامة `app/api/send-email/route.ts`
- تعريفات Typescript في `types/email.ts`

## الملفات الأساسية

### `services/email.service.ts`

وظائف هذه الخدمة:
- `sendEmail()` لإرسال أي بريد عبر Resend
- `validateConfig()` للتحقق من إعداد المفاتيح
- دوال متخصصة لكل نوع بريد:
  - `sendSubscriptionExpiringEmail()`
  - `sendRenewalSuccessEmail()`
  - `sendRefundCreatedEmail()`
  - `sendWithdrawalNoticeEmail()`
  - `sendFreezeNotificationEmail()`
  - `sendSecurityAlertEmail()`
  - `sendFailedLoginAlertEmail()`
  - `sendAccountSuspendedEmail()`

النقاط المهمة:
- يتم إنشاء عميل Resend بشكل lazy داخل `getResend()`
- يتم قراءة `RESEND_API_KEY` من البيئة
- `FROM` يقرأ من `RESEND_FROM_EMAIL` أو يستخدم قيمة افتراضية
- الخطأ في الإرسال يُسجّل ويُرجع كائن نتيجة موحد

### `types/email.ts`

يحتوي على:
- `EmailResult`
- `SendEmailPayload`
- `EmailType`
- نماذج البيانات لكل قالب بريد:
  - `SubscriptionExpiringData`
  - `RenewalSuccessData`
  - `RefundCreatedData`
  - `WithdrawalNoticeData`
  - `FreezeNotificationData`
  - `SecurityAlertData`
  - `FailedLoginData`
  - `AccountSuspendedData`
- `SendEmailRequest` لطلب API العام

### `app/api/send-email/route.ts`

واجهة عامة لاستقبال طلب POST وإرسال البريد وفق النوع.

السلوك:
- يتحقق من إعداد `RESEND_API_KEY`
- يقرأ `type`, `to`, `data` من الجسم
- يطابق النوع للدالة الصحيحة في `emailService`
- يرجع JSON ناجح أو خطأ

هذه الواجهة مخصصة للمنطق الخلفي فقط، لذلك لا يُفترض استدعاؤها من الواجهة الأمامية مباشرة بدون تحكم أمني.

### `app/api/test-email/route.ts`

واجهة GET لاختبار إرسال البريد الحي.

المعلمات:
- `to` — بريد المستلم (افتراضي: `zoromedo2000@gmail.com`)
- `type` — نوع البريد التجريبي

أنواع الاختبار المدعومة في المسار:
- `subscription_expiring`
- `renewal_success`
- `refund_created`
- `withdrawal_notice`
- `freeze_notification`
- `failed_login`
- `account_suspended`
- `security_alert`

يُستخدم هذا المسار لإرسال بريده تجريبي واقعي مع بيانات نموذجية.

## القوالب البريدية

المجلد `emails/` يحتوي على قوالب HTML مع تصميم احترافي بالعربية:
- `subscription-expiring.tsx`
- `renewal-success.tsx`
- `refund-created.tsx`
- `withdrawal-notice.tsx`
- `freeze-notification.tsx`
- `security-alert.tsx`
- `failed-login.tsx`
- `account-suspended.tsx`

كل قالب يعتمد على بنية مشتركة لواجهة البريد ويُرجع HTML نظيفًا يستجيب لعرض الرسائل.

## أنظمة البريد المدعومة

### أنواع البريد الموجودة

1. `subscription_expiring` — تنبيه بإنتهاء الاشتراك
2. `renewal_success` — تأكيد تجديد الاشتراك
3. `refund_created` — إشعار استرداد مالي
4. `withdrawal_notice` — إشعار انسحاب
5. `freeze_notification` — إشعار تجميد اشتراك
6. `security_alert` — تنبيه أمني عام
7. `failed_login` — تنبيه محاولات دخول فاشلة
8. `account_suspended` — تعليق حساب

## البيئة والمتغيرات

### مطلوب في `.env.local`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (اختياري)

مثال موجود في المشروع:
```env
RESEND_API_KEY=re_X2KMzs5o_JPoZ3whTvr3gG5SWDu24F3Bw
RESEND_FROM_EMAIL=Joker Dashboard <onboarding@resend.dev>
```

> تأكد من أن المفتاح لا يُنقل إلى العميل أبداً. جميع الاستدعاءات تتم من الخادم.

## مجرى التنفيذ

1. حدث داخلي في النظام
2. استدعاء `app/api/send-email/route.ts` أو استخدام `emailService` من كود خادم آخر
3. `emailService` يحدد القالب المناسب
4. يتم توليد HTML احترافي
5. Resend يرسل البريد
6. يتم إعادة نتيجة موحدة مع `success`, `messageId`, أو `error`

## كيف تختبر النظام

### اختبار عبر المسار التجريبي

زيارة:
```
http://localhost:3000/api/test-email?to=example@domain.com&type=subscription_expiring
```

### إرسال بريد عبر API

مثال طلب POST:
```json
POST /api/send-email
{
  "type": "refund_created",
  "to": "admin@joker.sa",
  "data": {
    "subscriberName": "خالد إبراهيم",
    "amount": 200,
    "currency": "SAR",
    "createdBy": "ريم (موظفة)",
    "refundDate": "2026-05-10",
    "reason": "طلب المشترك إلغاء الاشتراك"
  }
}
```

## التكامل مع النظام الحالي

### حالة موجودة
- يوجد `notification.service.ts` و `alert-engine.service.ts` لبناء إشعارات داخلية في Firestore
- حتى الآن الـ email service مستقل ويمكن ربطه لاحقاً بالمنطق الآتي:
  - إنشاء إشعار داخلي + إرسال بريد عند حدث مالي حساس
  - إرسال تنبيه أمني لمالك النظام/الإدارة عند فشل تسجيل دخول أو تعليق الحساب
  - إرسال تنبيهات الاشتراك القابلة للتجديد إلى المسؤولين

### نقطة تطوير مستقبلية
- إضافة ربط مباشر بين `alertEngineService` و `emailService` لإرسال بريد تلقائياً عندما يتولد تنبيه هام
- إضافة دعم قوائم توزيع و`segments` عبر Resend
- إضافة دعم طابور إرسال (queue) للرسائل الكبيرة
- إضافة سجل إرسال كامل وربط مع `audit logs`

## ملاحظات أمان

- `emailService` مصمم للعمل من الجانب الخادم فقط
- لا تُستورد الخدمة في مكونات الواجهة الأمامية
- يتم التحقق من `RESEND_API_KEY` قبل أي إرسال
- إذا فشل الإرسال، يتم تسجيل الخطأ وإرجاع استجابة JSON مناسبة

## الخلاصة

النظام الحالي يقدم بنية بريدية احترافية:
- Server-side only
- قابل للتوسع
- مدعوم بأنواع بريد متنوعة
- يحتوي على واجهات API لإرسال واختبار البريد
- يستخدم قوالب HTML نظيفة لكل نوع

يمكن توسيع هذا النظام لاحقاً ليشمل:
- رسائل واتساب أو إشعارات دفع
- جدولة رسائل دورية
- تكامل مباشر مع تنبيهات `notification center`
- دعم إرسال مجمع عبر Resend
