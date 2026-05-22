# Testing Guide

## نظرة عامة

المشروع يحتوي على نوعين من الاختبارات:

### 1. Unit Tests (Jest)
اختبارات للـ functions والـ components بشكل منفصل.

### 2. E2E Tests (Playwright)
اختبارات للـ workflows الكاملة من منظور المستخدم.

---

## Unit Tests

### التشغيل

```bash
# تشغيل جميع الاختبارات
npm test

# التشغيل بـ watch mode
npm run test:watch

# التغطية (Coverage)
npm run test:coverage
```

### كتابة اختبار جديد

#### مثال: اختبار للـ Utility Function

```typescript
// __tests__/lib/permissions.test.ts
import { calculatePermissions } from '@/lib/permissions'

describe('calculatePermissions', () => {
  it('should grant owner all permissions', () => {
    const user = {
      uid: '1',
      role: 'owner',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: '2024-01-01',
    }

    const perms = calculatePermissions(user)

    expect(perms.canViewAll).toBe(true)
    expect(perms.canCreate).toBe(true)
    expect(perms.canDelete).toBe(true)
  })

  it('should restrict employee permissions', () => {
    const user = {
      uid: '2',
      role: 'employee',
      email: 'emp@example.com',
      name: 'Employee',
      createdAt: '2024-01-01',
    }

    const perms = calculatePermissions(user)

    expect(perms.canViewAll).toBe(false)
    expect(perms.canManageUsers).toBe(false)
  })
})
```

#### مثال: اختبار للـ Component

```typescript
// __tests__/components/StatsCard.test.tsx
import { render, screen } from '@testing-library/react'
import StatsCard from '@/components/stats/StatsCards'

describe('StatsCard', () => {
  it('should display stats correctly', () => {
    render(
      <StatsCard
        title="المشتركون النشطون"
        value={150}
        icon="👥"
      />
    )

    expect(screen.getByText('المشتركون النشطون')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    render(
      <StatsCard
        title="المشتركون"
        value={undefined}
        loading={true}
      />
    )

    const skeleton = screen.getByTestId('stat-skeleton')
    expect(skeleton).toBeInTheDocument()
  })
})
```

### أفضل الممارسات (Best Practices)

- ✅ تجنب اختبارات التفاصيل (implementation details)
- ✅ اختبر السلوك من منظور المستخدم
- ✅ استخدم `screen` بدلاً من `container`
- ✅ اختبر الحالات الحدية (edge cases)
- ✅ استخدم descriptive test names

---

## E2E Tests

### التشغيل

```bash
# تشغيل جميع الاختبارات
npm run test:e2e

# الوضع التفاعلي (UI)
npm run test:e2e:ui

# اختبار specific
npx playwright test dashboard.spec.ts
```

### كتابة اختبار E2E جديد

```typescript
// e2e/subscribers.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Subscriber Management', () => {
  test.beforeEach(async ({ page }) => {
    // الإعداد قبل كل اختبار
    await page.goto('/')
    await page.waitForSelector('[id="tour-stats"]', { timeout: 5000 })
  })

  test('should add new subscriber', async ({ page }) => {
    // 1. افتح modal
    const addButton = page.locator('button:has-text("مشترك جديد")')
    await addButton.click()

    // 2. انتظر modal
    const modal = page.locator('[class*="modal"]')
    await expect(modal).toBeVisible()

    // 3. املأ النموذج
    await page.locator('input[placeholder*="الاسم"]').fill('محمد أحمد')
    await page.locator('input[placeholder*="الهاتف"]').fill('966501234567')

    // 4. أرسل
    await page.locator('button:has-text("حفظ")').click()

    // 5. تحقق من النجاح
    await expect(
      page.locator('text=تم الحفظ بنجاح')
    ).toBeVisible()
  })

  test('should delete subscriber', async ({ page }) => {
    // افتح الجدول
    const subscribersTab = page.locator('text=المشتركون')
    await subscribersTab.click()

    // اضغط على آيقونة الحذف
    const deleteButton = page.locator('[title*="حذف"]').first()
    await deleteButton.click()

    // أكد الحذف
    const confirmButton = page.locator('button:has-text("حذف نهائياً")')
    await confirmButton.click()

    // تحقق من النجاح
    await expect(
      page.locator('text=تم الحذف بنجاح')
    ).toBeVisible()
  })
})
```

### Selectors

استخدم هذه الـ selectors:

```typescript
// حسب النص
page.locator('button:has-text("حفظ")')

// حسب id
page.locator('#tour-header')

// حسب class
page.locator('[class*="panel"]')

// XPath
page.locator('//button[contains(text(), "حفظ")]')
```

### أفضل الممارسات

- ✅ استخدم `waitForSelector` للعناصر الديناميكية
- ✅ تجنب sleep/timeout إذا أمكن
- ✅ اختبر من منظور المستخدم
- ✅ اختبر في كل المتصفحات (Chrome, Firefox, Safari)
- ✅ اختبر responsive design

---

## Coverage Goals

| النوع | الهدف | الحالي |
|------|-------|-------|
| Statements | 80% | 40% |
| Branches | 75% | 35% |
| Functions | 80% | 40% |
| Lines | 80% | 40% |

### زيادة Coverage

```bash
# عرض التقرير التفصيلي
npm run test:coverage

# عرض في المتصفح
open coverage/lcov-report/index.html
```

---

## التكامل مع CI/CD

جميع الاختبارات تعمل تلقائياً عند:
- فتح Pull Request
- الـ Push إلى main
- الـ Merge

---

## استكشاف الأخطاء

### اختبار يفشل محلياً فقط

```bash
# جرب بـ headless mode
npx playwright test --headed

# جرب بـ specific browser
npx playwright test --project=firefox

# شاهد التتبع
npx playwright show-trace trace.zip
```

### أداة Debugging

```bash
# فتح Playwright Inspector
npx playwright test --debug

# شاهد في الفيديو
npx playwright test --headed --video=on
```

---

## الموارد الإضافية

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
