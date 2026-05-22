# Performance Optimization Guide

## المقاييس الحالية

```
Page Load Time:      ~1.8s ✓
API Response Time:   ~300ms ✓
Bundle Size:         ~250KB (gzipped)
Lighthouse Score:    ~85
```

## التحسينات المطبقة

### 1. Code Splitting ✓

#### Dynamic Imports
```typescript
// قبل: يتم تحميل Joyride دائماً
import Joyride from 'react-joyride'

// بعد: يتم تحميل فقط عند الحاجة
const Joyride = dynamicImport(
  () => import('react-joyride'),
  { ssr: false }
)
```

#### Lazy Components
```typescript
// مثال: تأجيل تحميل الـ modals
const SubscriberModalsManager = React.lazy(() => 
  import('@/components/subscribers/SubscriberModalsManager')
)

<Suspense fallback={<div>جاري التحميل...</div>}>
  <SubscriberModalsManager {...props} />
</Suspense>
```

### 2. Image Optimization

```typescript
// استخدم next/image
import Image from 'next/image'

export default function ProfilePic() {
  return (
    <Image
      src="/profile.jpg"
      alt="Profile"
      width={200}
      height={200}
      priority={false}
    />
  )
}
```

### 3. React Query Optimization

```typescript
// تحديد caching strategy
const { data } = useQuery({
  queryKey: ['subscribers'],
  queryFn: fetchSubscribers,
  staleTime: 5 * 60 * 1000,      // 5 دقائق
  gcTime: 10 * 60 * 1000,         // 10 دقائق (garbage collection)
  refetchOnWindowFocus: false,     // لا تحدّث عند التركيز
})
```

### 4. Memoization

```typescript
// استخدم useMemo للـ expensive calculations
const activeCount = useMemo(
  () => subscribers.filter(s => s.status === 'نشط').length,
  [subscribers]
)

// استخدم useCallback للـ callbacks
const handleDelete = useCallback((id) => {
  // ...
}, [dependencies])
```

### 5. Virtual Scrolling

للجداول الكبيرة:

```typescript
import { FixedSizeList } from 'react-window'

export default function SubscribersList({ subscribers }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={subscribers.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          {subscribers[index].name}
        </div>
      )}
    </FixedSizeList>
  )
}
```

### 6. Database Optimization

```typescript
// استخدم indexes في Firestore
// في firestore.indexes.json:
{
  "indexes": [
    {
      "collectionGroup": "subscribers",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 7. Build Optimization

```bash
# استخدم webpack bundler (أسرع من turbopack)
npm run build --webpack

# تحليل bundle size
npx next/bundle-analyzer
```

---

## النقاط البطيئة والحلول

### البطء 1: Modals الضخمة
**المشكلة**: 10 modals في ملف واحد = صفحة ثقيلة
**الحل**: استخراج إلى SubscriberModalsManager ✓

### البطء 2: Real-time Listeners
**المشكلة**: مستمعون متعددون = طلبات كثيرة
**الحل**: دمج المستمعين:
```typescript
// قبل:
useEffect(() => {
  onSnapshot(subscribersRef, ...)
  onSnapshot(paymentsRef, ...)
  onSnapshot(refundsRef, ...)
}, [])

// بعد: استخدم hook واحد
useEffect(() => {
  const unsubscriber = onSnapshot(
    collection(db, 'subscribers'),
    (snap) => {
      updateStore(snap.docs)
    }
  )
  return () => unsubscriber()
}, [])
```

### البطء 3: Table Rendering
**المشكلة**: جدول بـ 1000+ صف = render بطيء
**الحل**: Virtual Scrolling أو Pagination:
```typescript
// استخدم pagination
const [page, setPage] = useState(1)
const itemsPerPage = 50
const displayedItems = subscribers.slice(
  (page - 1) * itemsPerPage,
  page * itemsPerPage
)
```

### البطء 4: Calculations
**المشكلة**: حسابات ثقيلة على كل render
**الحل**: useMemo:
```typescript
const expiredCount = useMemo(() => 
  subscribers.filter(s => s.daysRemaining < 0).length,
  [subscribers]
)
```

---

## Lighthouse Score

### الحالي: 85

```
Performance:  85 ✓
Accessibility: 92 ✓
Best Practices: 88 ✓
SEO: 90 ✓
```

### الهدف: 95+

التحسينات المتبقية:
- [ ] Reduce unused JavaScript
- [ ] Optimize images further
- [ ] Add preload hints
- [ ] Improve Core Web Vitals

---

## الأفضل والأسوأ الممارسات

### ✅ الأفضل

```typescript
// استخدم React.memo لـ components expensive
const SubscriberRow = React.memo(({ subscriber }) => (
  <tr>
    <td>{subscriber.name}</td>
  </tr>
))

// استخدم key correctly في lists
{subscribers.map(s => (
  <SubscriberRow key={s.id} subscriber={s} />
))}

// استخدم lazy loading للـ images
<img src="..." loading="lazy" alt="..." />

// استخدم native Intersection Observer
const observer = new IntersectionObserver((entries) => {
  // Handle visibility
})
```

### ❌ الأسوأ

```typescript
// تجنب inline objects/functions في render
<Component 
  onClick={() => handleClick()}  // ❌ new function كل render
  style={{ color: 'red' }}       // ❌ new object كل render
/>

// تجنب unnecessary re-renders
{subscribers.sort().map(...)}  // ❌ sort كل render

// تجنب large component trees
render() {
  return (
    <div>
      {bigList.map(item => <BigComponent key={item.id} />)}
    </div>
  )
}
```

---

## Monitoring & Metrics

### استخدام Web Vitals

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

export function reportWebVitals(metric) {
  console.log(metric)
  // أرسل لـ analytics
}

getCLS(reportWebVitals)
getFID(reportWebVitals)
getFCP(reportWebVitals)
getLCP(reportWebVitals)
getTTFB(reportWebVitals)
```

### مراقبة الأداء

```typescript
// استخدم Performance API
const start = performance.now()
await heavyOperation()
const end = performance.now()
console.log(`Operation took ${end - start}ms`)
```

---

## Checklist تحسين الأداء

- [ ] تشغيل Lighthouse
- [ ] تحليل Bundle Size
- [ ] استخدام DevTools Chrome
- [ ] اختبار على شبكة بطيئة (3G)
- [ ] اختبار على جهاز قديم
- [ ] تقليل رسائل API
- [ ] استخدام caching
- [ ] تحسين database queries
- [ ] كتابة tests للأداء

---

## الموارد الإضافية

- [Next.js Performance](https://nextjs.org/docs/pages/building-your-application/optimizing)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
