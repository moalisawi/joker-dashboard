# نظام التصميم — Joker Dashboard Design System

> **الإصدار:** 1.0  
> **الاتجاه:** Modern SaaS Analytics Dashboard  
> **اللغة:** Arabic-first · RTL  
> **آخر تحديث:** 2026-05-21

---

## رؤية التصميم

الواجهة يجب أن تشعر كـ:
- منصة SaaS حديثة
- منتج تحليلات احترافي
- لوحة تحكم للمؤسسات
- نظيفة وموثوقة
- سريعة وتفاعلية

---

## المبادئ الأساسية

1. **الاتساق البصري** — نفس المسافات، نفس الـ radius، نفس الطباعة في كل مكان
2. **تجربة تحليلات نظيفة** — تقليل الضوضاء البصرية، إبراز الـ KPIs
3. **واجهة ناعمة** — أسطح ناعمة، زوايا مدوّرة، بطاقات طائرة، ظلال خفيفة

---

## لوحة الألوان الرسمية

### الألوان الأساسية

```css
--primary:        #5B5FEF;   /* الأزرق الكهربائي — الأزرار، الـ nav الفعّال، الرسوم */
--primary-hover:  #4F46E5;   /* hover على الأزرار */
--primary-light:  #EEF0FF;   /* خلفية خفيفة للأزرار الثانوية */
--primary-soft:   #C7D2FE;   /* تظليل ناعم */
```

### خلفية النظام

```css
--background: #F5F7FB;  /* خلفية التطبيق الرئيسية */
```

### ألوان الأسطح

```css
--surface:           #FFFFFF;  /* البطاقات، الـ modals، الـ inputs */
--surface-secondary: #F8FAFC;  /* hover rows، خلفيات ثانوية */
--surface-muted:     #F1F5F9;  /* أقسام خاملة */
```

### ألوان النصوص

```css
--text-primary:   #111827;  /* النص الرئيسي */
--text-secondary: #6B7280;  /* النص الثانوي */
--text-muted:     #9CA3AF;  /* placeholder، تسميات خافتة */
--text-white:     #FFFFFF;  /* نص على خلفية داكنة */
```

### ألوان الحدود

```css
--border-light: #E5E7EB;  /* حدود البطاقات والـ inputs */
--border-soft:  #EEF2F7;  /* فواصل ناعمة */
```

### ألوان الحالات

```css
/* Success */
--success:    #22C55E;
--success-bg: #ECFDF3;

/* Warning */
--warning:    #F59E0B;
--warning-bg: #FFFBEB;

/* Danger */
--danger:     #EF4444;
--danger-bg:  #FEF2F2;

/* Info */
--info:       #3B82F6;
--info-bg:    #EFF6FF;
```

### البطاقة الداكنة (Featured KPI)

```css
--dark-card-from: #0B1020;
--dark-card-to:   #1A2745;
/* gradient: linear-gradient(145deg, #0B1020, #1A2745) */
```

---

## نظام الطباعة

### الخط الأساسي

**Cairo** (Google Fonts) — Arabic-first مع fallback:

```css
font-family: 'Cairo', Inter, system-ui, sans-serif;
```

> ملاحظة: المشروع عربي RTL — Cairo هو الخط الأساسي. Inter للنصوص اللاتينية فقط.

### مقياس الأحجام

| الاستخدام       | الحجم  | الوزن | letter-spacing |
|----------------|--------|-------|----------------|
| H1 الصفحة      | 38px   | 800   | -0.03em        |
| قيمة إحصائية   | 30px   | 800   | -0.025em       |
| عنوان مودال    | 17px   | 800   | -0.01em        |
| عنوان بطاقة    | 15.5px | 700   | -0.015em       |
| جسم النص       | 14px   | 400   | normal         |
| نص صغير        | 12.5px | 500   | normal         |
| Caption        | 12px   | 400   | normal         |

---

## نظام المسافات

**الوحدة الأساسية: 8px**

| Token | القيمة |
|-------|--------|
| xs    | 4px    |
| sm    | 8px    |
| md    | 16px   |
| lg    | 24px   |
| xl    | 32px   |
| 2xl   | 40px   |
| 3xl   | 48px   |

**قواعد:**
- padding البطاقات: `22–24px`
- gap بين البطاقات: `16–20px`
- padding المحتوى الرئيسي: `24px`

---

## نظام الـ Radius

| المكوّن            | الـ Radius |
|--------------------|-----------|
| Inputs             | 12px      |
| Buttons            | 14px      |
| Cards              | 22–24px   |
| Modals             | 28px      |
| Pills / Chips      | 999px     |
| Avatar             | 999px     |
| Icon containers    | 12–14px   |
| Progress bars      | 999px     |

---

## نظام الظلال

```css
/* بطاقة عادية */
--shadow-card: 0px 4px 20px rgba(15, 23, 42, 0.04);

/* بطاقة مرفوعة / hover */
--shadow-elevated: 0px 10px 30px rgba(15, 23, 42, 0.08);

/* مودال */
--shadow-modal: 0px 28px 64px rgba(15, 23, 42, 0.20);

/* nav item نشط */
--shadow-nav: 0px 6px 16px rgba(91, 95, 239, 0.30);
```

---

## هيكل اللayout

### بنية الداشبورد

```
Sidebar (عمودي) + Main Content
```

### Sidebar

- العرض: `80px` (icon-only)
- الخلفية: شفاف / Glassmorphism
- الشعار: مربع `48×48` بـ radius 14px
- أزرار التنقل: دائرية `42×42`
- الـ active item: خلفية `#5B5FEF` + ظل أزرق

### TopNav

- الارتفاع: `~60px`
- Glassmorphism: `backdrop-filter: blur(14px)`
- محتوى: Brand + links + icons + avatar

### المحتوى الرئيسي

```css
max-width: 1600px;
margin: auto;
padding: 24px;
```

---

## نظام البطاقات

### بطاقة عادية (Standard Card)

```css
background: #FFFFFF;
border-radius: 22px;
padding: 22px;
border: 1px solid #EEF2F7;
box-shadow: 0px 4px 20px rgba(15, 23, 42, 0.04);
```

**قواعد:**
- يجب أن تطفو بنعومة
- radius كبير
- padding ثابت
- لا حدود قاسية

### بطاقة KPI

```
[أيقونة + شارة %]
[تسمية]
[الرقم الكبير]
[نص مقارنة]
[sparkline اختياري]
```

### البطاقة الداكنة المميزة

```css
background: linear-gradient(145deg, #0B1020, #1A2745);
border-radius: 24px;
color: white;
/* + glow أزرق في الزاوية */
```

---

## قواعد الرسوم البيانية

**يجب أن تكون:**
- نظيفة وبسيطة
- خطوط شبكة ناعمة (`#F3F4F6`)
- محدودة الألوان

**ألوان الرسوم:**

```
أولي:    #5B5FEF
ثانوي:   #22C55E
ثالثي:   #F59E0B
رابعي:   #EF4444
خامسي:   #8B5CF6
سادسي:   #06B6D4
```

**Bar Charts:**
- أشرطة مدوّرة (radius أعلى: 6px)
- مسافات كبيرة
- تسميات بسيطة

**Area Charts:**
- خطوط ناعمة (type: "monotone")
- gradient fill خفيف
- glow خفيف على الخط

**Donut Charts:**
- سماكة عالية
- حواف ناعمة
- رقم مركزي كبير

---

## الجداول

```css
/* row hover */
background: #F8FAFC;
transition: background 0.1s;
```

**قواعد:**
- رأس الجدول: خلفية `#F8FAFC` + نص muted وزن 700
- صفوف: padding `12–14px 18px`
- فواصل: `1px solid #F3F4F6`

---

## الـ Inputs

```css
height: 44px;               /* أو 48px للـ forms الكبيرة */
border-radius: 12px;        /* inputs عادية */
/* pills مثل البحث: 999px */
border: 1px solid #E5E7EB;
background: #FFFFFF;
font-size: 13.5px;
```

**Focus:**

```css
border-color: #5B5FEF;
box-shadow: 0 0 0 4px rgba(91, 95, 239, 0.12);
```

---

## الأزرار

### Primary

```css
background: #5B5FEF;
color: #FFFFFF;
height: 44px;
padding: 0 20px;
border-radius: 14px;  /* أو 999px للـ pill style */
font-weight: 600;
font-size: 13.5px;
```

```css
/* hover */
background: #4F46E5;
transform: translateY(-1px);
```

### Secondary

```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
color: #111827;
```

### Ghost

```css
background: transparent;
color: #6B7280;
```

---

## الأيقونات

**المكتبة:** Lucide React

**القواعد:**
- الحجم: `18px` أو `20px`
- السُمك: `1.75` (stroke)
- لا خلط بين مكتبات مختلفة

---

## الحركة والتحريك

```
hover:           150ms ease
dropdown:        200ms ease
modal appear:    250ms cubic-bezier(0.34, 1.56, 0.64, 1)
page transition: 300ms easeOut
```

**Hover المسموح به:**
- `translateY(-2px)` خفيف
- زيادة ناعمة في الظل
- تغيير لون الخلفية

**ممنوع:**
- bounce
- scale كبير
- glow قوي

---

## الـ Status Chips / Badges

```css
/* pill shape دائماً */
border-radius: 999px;
padding: 4px 12px;
font-size: 12px;
font-weight: 600;
```

| الحالة  | اللون    | الخلفية  |
|---------|---------|---------|
| نشط     | #22C55E | #ECFDF3 |
| منتهي   | #EF4444 | #FEF2F2 |
| موقوف   | #F59E0B | #FFFBEB |
| مجمد    | #3B82F6 | #EFF6FF |
| منسحب   | #9CA3AF | #F1F5F9 |

---

## الـ Empty States

كل حالة فارغة يجب أن تحتوي:
- أيقونة دائرية `56×56` بخلفية `#F1F5F9`
- عنوان واضح `15px / 700`
- نص شرح `13px / muted`
- زر اقتراح عمل (اختياري)

---

## Loading States

- استخدم Skeleton loaders
- shimmer animation ناعم
- لا spinners في كل مكان

---

## Dark Mode (للمستقبل)

```css
--dark-bg:      #0F172A;
--dark-surface: #111827;
--dark-card:    #1E293B;
--dark-border:  #334155;
--dark-text:    #F8FAFC;
```

---

## القواعد الممنوعة ❌

- ممنوع مسافات عشوائية
- ممنوع gradients صاخبة متعددة
- ممنوع مزج أنظمة طباعة
- ممنوع الإفراط في الألوان الساطعة
- ممنوع `border-left` ملوّن على البطاقات
- ممنوع أشكال حادة الحواف — كل شيء مدوّر
- ممنوع inline SVG يدوي — استخدم Lucide
- ممنوع dark mode code (حتى يُقرَّر رسمياً)
- ممنوع ألوان خارج اللوحة المحددة

---

## Stack التقني

| الطبقة     | التقنية                          |
|-----------|----------------------------------|
| Framework | Next.js 16 (App Router)          |
| Styling   | Tailwind CSS + CSS Variables     |
| Charts    | Recharts                         |
| Animation | Framer Motion                    |
| Icons     | Lucide React                     |
| State     | Zustand + React Query            |
| Backend   | Firebase Firestore               |
| Font      | Cairo (Arabic) + Inter (Latin)   |

---

## مكوّنات يجب أن تكون reusable

```
DashboardLayout      → ProtectedLayout
Sidebar              → Sidebar.tsx
TopNav               → TopNav.tsx
StatCard             → FeaturedStatCard + StatCard
ChartCard            → Shell
AlertsPanel          → AlertsPanel.tsx
TableCard            → SubscribersTable
ActivityCard         → ActivityTab
```

---

## الهدف النهائي

المنتج يجب أن يشعر:
- **احترافي** — مناسب للمؤسسات
- **سلس** — تفاعلات ناعمة
- **موثوق** — بيانات واضحة
- **حديث** — مواكب لمعايير 2026
- **عربي** — مبني أصلاً للعربية، ليس مترجماً

لا يجب أن يشعر أبداً:
- مكدّساً
- رخيصاً
- متناقضاً
- مبالغاً في التحريك
