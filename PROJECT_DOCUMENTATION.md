# Joker Dashboard - وثائق المشروع الكاملة

## نظرة عامة

`joker-dashboard` هو تطبيق لوحة تحكم مبني على Next.js App Router مع تكامل Firebase وإرسال بريد إلكتروني عبر Resend. يقدم المشروع واجهة لإدارة المشتركين، الإشعارات، المدفوعات، والاستعلامات الإدارية.

## الأهداف الأساسية

- إدارة المشتركين والمدفوعات والاشتراكات
- تتبع عمليات الاسترداد والسحوبات والإشعارات
- توليد تحليلات وتقارير داخل لوحة تحكم تفاعلية
- دعم إرسال بريد إلكتروني محسّن عبر Resend لإشعارات النظام والأمان
- التكامل مع Firebase Firestore للمحتوى والبيانات

## التقنيات الرئيسية

- `next@16.2.6`
- `react@19.2.4`
- `typescript@5`
- `firebase@12.13.0`
- `resend@6.12.3`
- `zod` للتحقق من المدخلات
- `zustand` لإدارة الحالة البسيطة
- `framer-motion` للحركة والانتقالات
- `recharts` للرسوم البيانية
- `@heroui/react` للمكونات البصرية

## هيكل المشروع

### الجذر

- `README.md` - ملف الوثائق الرئيسي للمشروع الحالي
- `PROJECT_DOCUMENTATION.md` - هذا الملف الوثائقي الشامل
- `EMAIL_NOTIFICATION_SYSTEM.md` - وثائق نظام الإشعارات البريدية
- `package.json` - سكربتات المشروع والتبعيات
- `.env.production.example` - مثال متغيرات البيئة لـ Firebase وResend
- `next.config.ts` - إعدادات Next.js
- `tsconfig.json` - إعدادات TypeScript
- `firebase.json` - إعدادات Firebase المحلية / الإنتاجية
- `firestore.rules` - قواعد أمان Firestore
- `firestore.indexes.json` - فهارس Firestore

### `app/`

يضم واجهة التطبيق العامّة وطريق التطبيق:
- `app/page.tsx` - الصفحة الرئيسية
- `app/layout.tsx` - التخطيط العام للتطبيق
- `app/globals.css` - الأنماط العامة
- صفحات فرعية مثل:
  - `analytics/page.tsx`
  - `login/page.tsx`
  - `logs/page.tsx`
  - `notifications/page.tsx`
  - `users/page.tsx`

### `components/`

مكونات الواجهة القابلة لإعادة الاستخدام.
- `calendar/MonthlyCalendar.tsx`
- `layout/` - مكونات التخطيط مثل `AuthProvider.tsx`, `ProtectedLayout.tsx`, `Sidebar.tsx`
- `logs/` - مكونات تتعامل مع السجلات وعرض الفروقات
- `notifications/` وغيرها من المكونات المتخصصة

### `hooks/`

يحتوي على هوكس مخصصة للوصول إلى البيانات والمنطق:
- `useAuditLogs.ts`
- `useAuth.ts`
- `useFrozen.ts`
- `useMonthlyAnalytics.ts`
- `useNotificationsListener.ts`
- `usePayments.ts`
- `useRefunds.ts`
- `useSubscribers.ts`

### `lib/`

منطق دعم التطبيق والوظائف المشتركة:
- `auditLog.ts`
- `auth.ts`
- `currency.ts`
- `firebase.ts`
- `firestore.ts`
- `functions.ts`
- `migration.ts`
- `permissions.ts`
- `storage.ts`
- `utils.ts`

### `services/`

طبقة الخدمات المركزية للتعامل مع بيانات التطبيق:
- `alert-engine.service.ts`
- `analytics.service.ts`
- `audit.service.ts`
- `freeze.service.ts`
- `notification.service.ts`
- `payments.service.ts`
- `permission.service.ts`
- `refunds.service.ts`
- `subscribers.service.ts`
- `users.service.ts`
- `withdrawal.service.ts`
- `index.ts`

### `emails/`

قوالب البريد الإلكتروني HTML لكل نوع إشعار.

### `store/`

حالة تطبيق ZustLand:
- `authStore.ts`
- `notificationStore.ts`

### `types/`

أنواع TypeScript المخصصة:
- `analytics.ts`
- `auditLog.ts`
- `common.ts`
- `freeze.ts`
- `notification.ts`
- `payment.ts`
- `permissions.ts`
- `refund.ts`
- `subscriber.ts`
- `user.ts`
- `withdrawal.ts`

## نقاط مهمة في المشروع

### التكامل مع Firebase

- يستخدم المشروع `firebase` للمصادقة وتخزين البيانات
- يعتمد على قواعد `firestore.rules` و `firestore.indexes.json`
- يمكن نشره عبر Firebase باستخدام `firebase deploy`

### نظام البريد الإلكتروني

- تم تطوير `services/email.service.ts` لإرسال رسائل عبر Resend
- تعتمد الرسائل على نوع `EmailType` وبيانات `SendEmailPayload`
- توجد واجهات API خاصة في `app/api/send-email/route.ts` و`app/api/test-email/route.ts`
- وثيقة مفصلة للنظام موجودة في `EMAIL_NOTIFICATION_SYSTEM.md`

## إعداد البيئة

### متغيرات بيئة أساسية

يجب إعداد حسب بيئة التطوير أو الإنتاج في `.env.local` أو `.env.production`.

#### Firebase
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

#### Resend
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## أوامر مهمة

- `npm run dev` - تشغيل التطبيق في وضع التطوير
- `npm run build` - بناء التطبيق للإنتاج
- `npm run start` - تشغيل التطبيق بعد البناء
- `npm run lint` - فحص الأكواد عبر ESLint

## ملاحظات إضافية

- يحتوي `README.md` الحالي على قالب افتراضي من Next.js، وهو قابل للتحديث لاحقاً إذا أردت.
- إذا كان الهدف هو التوثيق الكامل للمشروع، فإن هذا الملف `PROJECT_DOCUMENTATION.md` هو المرجع المنفصل.
- إذا كان لديك متطلبات محددة إضافية (مثل وثائق API، سير العمل، أو مخطط تدفق البيانات)، يمكنني إضافة قسم مخصص لها.
