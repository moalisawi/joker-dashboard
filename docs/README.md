# Documentation

## مرحباً بك في توثيق joker-dashboard 👋

هذا المجلد يحتوي على جميع التوثيقات الشاملة والأدلة للمشروع.

## المستندات الرئيسية

### 📐 [ARCHITECTURE.md](./ARCHITECTURE.md)
شرح شامل لـ معمارية التطبيق:
- البنية المعمارية (layers)
- مسارات البيانات (data flows)
- نموذج الأمان (security model)
- مجلد الملفات (file structure)
- أنماط التصميم (design patterns)

**من يقرأه**: المهندسين الجدد، معماريين، CTOs

---

### 🔌 [API.md](./API.md)
توثيق كامل للـ API endpoints:
- جميع نقاط النهاية (endpoints)
- طلبات وردود (requests/responses)
- رموز الأخطاء (error codes)
- أمثلة الاستخدام (examples)
- معدل الحد (rate limiting)

**من يقرأه**: Backend developers، API consumers

---

### 🧪 [TESTING.md](./TESTING.md)
دليل شامل للـ testing:
- كتابة Unit Tests مع Jest
- كتابة E2E Tests مع Playwright
- أفضل الممارسات
- استكشاف الأخطاء
- أهداف التغطية (coverage goals)

**من يقرأه**: QA engineers، developers

---

### ⚡ [PERFORMANCE.md](./PERFORMANCE.md)
دليل تحسين الأداء:
- المقاييس الحالية
- التحسينات المطبقة
- النقاط البطيئة والحلول
- Lighthouse optimization
- أفضل الممارسات

**من يقرأه**: Frontend developers، DevOps

---

## 🛡️ سجلات الجلسات

سجلات مؤرّخة لما تغيّر في الإنتاج ولماذا. تُقرأ قبل لمس القواعد أو الفهارس أو نموذج
الصلاحيات — فيها أعطال يسهل جداً إعادة إدخالها.

### [SECURITY-HARDENING-2026-08.md](./SECURITY-HARDENING-2026-08.md) — ٢ أغسطس ٢٠٢٦
- **دالة قواعد Firestore لا تقبل `if`** — يجب أن تكون تعبير `return` واحداً. مخالفةُ ذلك
  ترفض النشر برسالة `INVALID_ARGUMENT` بلا تفاصيل، وقد أبقت قواعد أضعف حيّة ثلاثة أشهر
- عزل الموظفين على مستوى الصف · تعبئة `convincedByUid` · تعارض الواجهة مع القواعد
- **الترتيب إجباري**: تعبئة البيانات ← الفهارس ← القواعد

### [CHANGELOG-2026-08-10.md](./CHANGELOG-2026-08-10.md) — ١٠ أغسطس ٢٠٢٦
- **الإنتاج كان بلا متغيّرات بيئة** فشحن مفتاح Firebase وهمياً وكسر كل تسجيل دخول شهوراً،
  بينما كل عمليات النشر خضراء. `NEXT_PUBLIC_*` تُحقن وقت البناء
- عطلان ماليان: `Number(null)` يبطل حارس سعر الصرف · خلط UTC بالمحلي في حساب التواريخ
- **سقف الأدوار** — كان موظف المبيعات يتفوّق على المدير

**من يقرأه**: أي أحد قبل نشر تغيير على `joker-prod`

---

## دليل البدء السريع

### للمهندس الجديد (New Engineer)

1. اقرأ **ARCHITECTURE.md** لفهم البنية
2. اقرأ **TESTING.md** لفهم كيفية الاختبار
3. ابدأ بـ simple feature من `docs/FEATURES.md`

### لـ API Integration

1. اقرأ **API.md** بالكامل
2. استخدم أمثلة cURL من documentation
3. اختبر مع Postman

### لـ Optimization

1. اقرأ **PERFORMANCE.md**
2. شغّل `npm run test:coverage`
3. استخدم Lighthouse DevTools

---

## الأسئلة الشائعة

### Q: أين أضيف feature جديد؟
**A**: انظر إلى ARCHITECTURE.md > "Adding Features"

### Q: كيف أكتب اختبار؟
**A**: اقرأ TESTING.md > "Writing Tests"

### Q: كيف أحسّن الأداء؟
**A**: اقرأ PERFORMANCE.md > "Optimizations"

### Q: كيف أناديMyAPI endpoint؟
**A**: اقرأ API.md > "Examples"

---

## معايير الجودة

| المعيار | الهدف | الحالي |
|--------|-------|-------|
| Test Coverage | 80% | 40% |
| Lighthouse Score | 95+ | 85 |
| Page Load Time | < 2s | 1.8s ✓ |
| API Response | < 500ms | 300ms ✓ |

---

## إضافة التوثيق الجديد

عند إضافة ميزة جديدة، أضف:

1. **Architecture Update**
   ```markdown
   ## New Feature Name
   
   ### Purpose
   ### Implementation
   ### Data Flow
   ```

2. **API Documentation** (إن كان API جديد)
   ```markdown
   ### POST /api/new-feature
   
   **Request**
   **Response**
   **Error Codes**
   ```

3. **Tests**
   - Unit tests في `__tests__/`
   - E2E tests في `e2e/`

4. **Performance Notes**
   - أي optimizations مطبقة
   - أي bottlenecks محتملة

---

## الترجمة والنسخ

جميع التوثيقات:
- ✅ مكتوبة بالعربية (واجهات)
- ✅ مكتوبة بالإنجليزية (الكود)
- ✅ RTL-friendly

---

## التحديثات الأخيرة

### 2026-08-10
- ✅ إصلاح تسجيل الدخول في الإنتاج (متغيّرات بيئة Vercel)
- ✅ استخراج الحسابات المالية إلى `lib/subscriberFinance.ts` مع ٥٧ اختباراً
- ✅ سقف الأدوار `ROLE_CEILING` مع ١٧ اختباراً — الاختبارات ٨٨ ← ١٦٢
- ✅ إزالة `unsafe-eval` من CSP الإنتاجي · إعادة بناء صفحة المستخدمين
- ✅ `npm run audit:accounts`

### 2024-05-16
- ✅ إضافة Unit Tests (coverage 40%)
- ✅ إضافة E2E Tests
- ✅ تقسيم Modals
- ✅ إضافة EmptyState Component
- ✅ توثيق شاملة

### Coming Soon
- [ ] E2E tests للـ admin flows
- [ ] Performance optimization
- [ ] API rate limiting
- [ ] Component stories (Storybook)

---

## الدعم والمساهمة

### اسأل سؤال؟
1. ابحث في التوثيق أولاً
2. اسأل في فريق #engineering

### وجدت خطأ؟
1. فتح Issue على GitHub
2. وصف المشكلة بوضوح
3. اقترح حل

### تريد تحسين التوثيق؟
1. Fork المشروع
2. عدّل الملفات
3. اشرح التحسينات في PR

---

## ملاحظات مهمة

### 🔒 الأمان
- لا تشارك صفحات الويب للـ credentials
- جميع الـ tokens حساسة
- استخدم environment variables

### 🔄 الإصدارات
- تحدّث التوثيق مع كل update
- استخدم semantic versioning
- احتفظ بـ migration guides

### 📊 Analytics
- تتبع استخدام الـ API
- راقب الأداء الحية
- اجمع feedback من المستخدمين

---

**آخر تحديث**: 2024-05-16
**الإصدار**: 0.1.0
**الحالة**: Active Development 🚀
