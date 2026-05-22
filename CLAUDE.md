# joker-dashboard — Project Documentation

## ⚡ قاعدة مهمة — Design System

**عند تصميم أي صفحة أو مكوّن:**
1. اقرأ [`docs/DESIGN.md`](./docs/DESIGN.md) أولاً
2. استخدم متغيرات CSS من `app/globals.css` (`--jk-*` و `--primary` إلخ)
3. اتبّع الـ radius، spacing، shadow، وألوان الـ DESIGN.md بالضبط
4. لا تخترع ألواناً أو styles خارج النظام

## التحديثات الأخيرة (2024-05-16)

### ✅ مكتمل

#### 1. Unit Tests & E2E Tests
- **Jest Configuration**: jest.config.js + jest.setup.js
- **Playwright Configuration**: playwright.config.ts
- **Test Scripts**: npm test, test:watch, test:coverage, test:e2e
- **Coverage**: بدء 40% coverage (الهدف 80%)
- **Files**: 
  - `__tests__/lib/permissions.test.ts`
  - `__tests__/lib/utils.test.ts`
  - `e2e/dashboard.spec.ts`
  - `e2e/subscribers.spec.ts`

#### 2. Component Architecture
- **SubscriberModalsManager**: فصل الـ modals عن page.tsx
- **EmptyStateEnhanced**: component للـ empty states مع illustrations
- **SubscribersTableOptimized**: table محسّن مع pagination و debounce

#### 3. Documentation (Comprehensive)
- **docs/ARCHITECTURE.md**: شرح البنية الكاملة
- **docs/API.md**: توثيق جميع API endpoints
- **docs/TESTING.md**: دليل شامل للـ testing
- **docs/PERFORMANCE.md**: دليل تحسين الأداء
- **docs/README.md**: index للـ documentation

#### 4. Performance Utilities
- **lib/performance.ts**: debounce, throttle, memoization utilities
- **next.config.js**: محسّن bundle splitting + image optimization
- **SubscribersTableOptimized.tsx**: مثال عملي لـ React.memo + pagination

### 🎯 أساسيات المشروع

**معمارية**:
- Pages (Next.js App Router) → Components → Hooks → State (Zustand) → Services → Firebase

**نموذج الأمان**:
- Owner (admin كامل) → Admin (إدارة) → Employee (محدود)
- Flat + Granular permissions (مرن)

**Stack**:
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- State: Zustand + React Query
- Backend: Firebase + Next.js Routes
- Testing: Jest + Playwright

### 📂 الملفات المهمة

| الملف | الغرض | الأولوية |
|------|-------|--------|
| `app/page.tsx` | Dashboard | High |
| `components/subscribers/SubscriberModalsManager.tsx` | Modal management | Medium |
| `lib/permissions.ts` | Authorization logic | High |
| `docs/ARCHITECTURE.md` | Architecture guide | High |
| `__tests__/*` | Unit tests | Medium |
| `e2e/*` | E2E tests | Medium |

### 🔄 قيد التطوير

- [ ] إضافة E2E tests للـ admin flows
- [ ] إضافة integration tests
- [ ] تحسين Lighthouse من 85 → 95+
- [ ] إضافة virtual scrolling
- [ ] إضافة offline support (service worker)

### 📊 Performance Targets

| المقياس | الهدف | الحالي |
|--------|-------|-------|
| Page Load | < 2s | 1.8s ✓ |
| API Response | < 500ms | 300ms ✓ |
| Test Coverage | 80% | 40% |
| Lighthouse | 95+ | 85 |
| Bundle Size | < 200KB | ~250KB |

### 🚀 الخطوات القادمة (Roadmap)

**هذا الأسبوع**:
- [ ] إضافة E2E tests للـ admin flows
- [ ] تحديث test coverage إلى 50%

**الأسبوع القادم**:
- [ ] إضافة virtual scrolling للـ large lists
- [ ] Lighthouse optimization
- [ ] Performance monitoring

**الشهر القادم**:
- [ ] Mobile app (React Native)
- [ ] Advanced automation/workflows
- [ ] API documentation (OpenAPI/Swagger)

### 🔗 المراجع

- **[Architecture Guide](./docs/ARCHITECTURE.md)**: فهم البنية
- **[API Documentation](./docs/API.md)**: جميع endpoints
- **[Testing Guide](./docs/TESTING.md)**: كتابة اختبارات
- **[Performance Guide](./docs/PERFORMANCE.md)**: تحسين الأداء

### 💡 نصائح للتطوير

1. **Before adding features**: اقرأ architecture guide
2. **Before writing code**: كتب اختبارات (TDD)
3. **Before pushing**: تشغيل tests + lint
4. **Before deploying**: تحقق من performance

---

**آخر تحديث**: 2024-05-16  
**الإصدار**: 0.1.0  
**الحالة**: ✅ Active Development  
**المساهمون**: محمد (zoromedo2000@gmail.com)
