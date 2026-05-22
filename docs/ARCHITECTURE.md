# معمارية joker-dashboard

## نظرة عامة

joker-dashboard هو نظام إدارة متكامل مبني على Next.js 16 و Firebase مع معمارية حديثة تركز على:
- 🔐 الأمان والتحكم في الوصول (RBAC)
- ⚡ الأداء والـ Real-time updates
- 🎨 تجربة مستخدم احترافية
- 🧪 اختبارات شاملة
- 📚 توثيق واضح

## البنية المعمارية

```
┌─────────────────────────────────────────────────┐
│  Pages Layer (Next.js App Router)               │
│  ├── Dashboard (/)                              │
│  ├── Admin (employees, teams, settings)         │
│  ├── Analytics & Reports                        │
│  └── Public (login, 404)                        │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Component Layer                                 │
│  ├── UI Components (generic, reusable)          │
│  ├── Feature Components (domain-specific)       │
│  └── Layout Components (sidebar, navbar, etc)   │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  State Management (Zustand)                     │
│  ├── authStore (user, permissions)              │
│  ├── notificationStore                          │
│  ├── themeStore                                 │
│  └── searchStore                                │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Data Fetching Layer (React Query)              │
│  ├── Custom hooks (useSubscribers, etc)         │
│  ├── Real-time listeners (onSnapshot)           │
│  └── Caching & invalidation                     │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  API Layer (Next.js Routes)                     │
│  ├── /api/subscriber-operations                 │
│  ├── /api/payments                              │
│  ├── /api/whatsapp-operations                   │
│  └── Server-side validation & auth              │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Services Layer                                 │
│  ├── Firestore operations                       │
│  ├── Audit logging                              │
│  ├── Email notifications                        │
│  └── Business logic                             │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Firebase (Firestore + Auth)                    │
│  ├── Real-time database                         │
│  ├── User authentication                        │
│  └── Security rules                             │
└─────────────────────────────────────────────────┘
```

## مسارات البيانات الرئيسية

### 1. تدفق المصادقة (Authentication Flow)

```
User enters credentials
        ↓
Firebase Auth validates
        ↓
useAuthListener() reads user profile from Firestore
        ↓
authStore updates with user & permissions
        ↓
ProtectedLayout checks auth state
        ↓
Routes render based on permissions
```

### 2. تدفق العملية (Operation Flow)

```
User triggers action (e.g., add subscriber)
        ↓
Component opens modal with form
        ↓
React Hook Form + Zod validation
        ↓
User submits → callSubscriberOperation()
        ↓
API Route receives & validates
        ↓
Services perform Firestore writes
        ↓
Audit log is created
        ↓
React Query cache invalidates
        ↓
Components update from fresh data
        ↓
Toast notification confirms
```

### 3. تدفق البيانات الحية (Real-time Flow)

```
Component mounts
        ↓
useSubscribers() hook runs
        ↓
Sets up onSnapshot listener
        ↓
Firestore pushes updates
        ↓
React Query updates cache
        ↓
Component re-renders
```

## نموذج الأمان

### نموذج الأدوار

| الدور | المستوى | الصلاحيات |
|------|--------|---------|
| **Owner** | 3 | إدارة كاملة + إدارة المستخدمين |
| **Admin** | 2 | إدارة المشتركين + التحليلات |
| **Employee** | 1 | إدارة المشتركين المعينين فقط |

### نقاط الفحص الأمنية

1. **Frontend**: 
   - `can()` و `perm()` قبل عرض الأزرار
   - Permissions من authStore

2. **Backend**:
   - `verifyServerUser()` يتحقق من الرمز
   - `hasServerPermission()` يتحقق من الصلاحيات
   - Firestore rules تقيد الوصول

3. **Database**:
   - Security rules في firestore.rules
   - Read/write rules حسب الأدوار

## مجلد الملفات الرئيسية

```
joker-dashboard/
├── app/                              # Next.js pages
│   ├── page.tsx                      # Dashboard
│   ├── admin/                        # Admin pages
│   ├── analytics/                    # Analytics
│   ├── api/                          # API routes
│   └── login/                        # Login page
│
├── components/                       # React components
│   ├── layout/                       # Layout components
│   ├── stats/                        # Stats components
│   ├── subscribers/                  # Subscriber components
│   │   ├── modals/                   # Modal components
│   │   └── SubscriberModalsManager.tsx
│   └── ui/                           # Generic UI components
│
├── hooks/                            # Custom React hooks
│   ├── useSubscribers.ts
│   ├── usePayments.ts
│   └── useAuth.ts
│
├── store/                            # Zustand stores
│   ├── authStore.ts
│   ├── notificationStore.ts
│   └── themeStore.ts
│
├── services/                         # Business logic
│   ├── subscribers.service.ts
│   ├── audit.service.ts
│   └── email.service.ts
│
├── lib/                              # Utilities
│   ├── auth.ts
│   ├── firestore.ts
│   ├── permissions.ts
│   └── sessionLogger.ts
│
├── types/                            # TypeScript types
│   ├── subscriber.ts
│   ├── payment.ts
│   └── user.ts
│
├── __tests__/                        # Unit tests
│   ├── lib/
│   └── components/
│
├── e2e/                              # E2E tests
│   ├── dashboard.spec.ts
│   └── subscribers.spec.ts
│
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md               # هذا الملف
│   ├── API.md
│   └── COMPONENTS.md
│
└── jest.config.js & playwright.config.ts
```

## أنماط التصميم المستخدمة

### 1. Component Composition
- **Page Components**: مستويات عليا
- **Feature Components**: منطق محدد
- **UI Components**: generic قابلة لإعادة الاستخدام

### 2. State Management
- **Zustand**: الحالة العامة (auth, theme, notifications)
- **React Query**: بيانات الخادم (caching, invalidation)
- **useState**: الحالة المحلية للـ component

### 3. Validation
- **Zod**: تحقق من صحة البيانات
- **React Hook Form**: إدارة النماذج
- **Server-side**: تحقق إضافي في API routes

### 4. Data Access
- **Services**: طبقة منطق الأعمال
- **Firestore hooks**: واجهة الوصول للبيانات
- **Real-time listeners**: تحديثات مباشرة

## المتطلبات غير الوظيفية

### الأداء
- Page load: < 2 ثانية
- API response: < 500ms
- Build time: < 3 دقائق

### الأمان
- Firebase Auth للمصادقة
- Firestore rules للتحكم في الوصول
- API validation على الخادم
- Audit logs لكل عملية

### التوفرية
- Mobile responsive
- Dark mode support
- RTL support
- Keyboard navigation

### الاختبارات
- Unit tests: 40%+ coverage
- E2E tests: Main workflows
- Integration tests: API routes

## كيفية الإضافة (Adding Features)

### 1. إضافة صفحة جديدة
```bash
1. Create app/feature/page.tsx
2. Add navigation in Sidebar.tsx
3. Add types in types/
4. Add services if needed
```

### 2. إضافة component جديد
```bash
1. Create in components/feature/
2. Use TypeScript types
3. Add unit test
4. Add story/docs if complex
```

### 3. إضافة API route
```bash
1. Create app/api/feature/route.ts
2. Add verifyServerUser()
3. Add permission check
4. Add audit logging
5. Add error handling
```

## الموارد الإضافية

- [API Documentation](./API.md)
- [Component Documentation](./COMPONENTS.md)
- [Testing Guide](./TESTING.md)
- [Security Guide](./SECURITY.md)
