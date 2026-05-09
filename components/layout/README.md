# الجوكر - Joker Dashboard

Modern RTL Arabic SaaS Dashboard for Nutrition Subscription Management System

## 🎨 Design Features

### Sidebar Component (`components/layout/Sidebar.tsx`)

A professional, modern sidebar component with:

- **RTL Arabic Support**: Full right-to-left layout compatibility
- **Dark Modern Design**: Gradient background from slate-950 to slate-900
- **Orange Accent Color**: Primary brand color for active states and highlights
- **Responsive Design**: Collapses to mobile menu on smaller screens
- **Smooth Animations**: Framer Motion transitions and hover effects

#### Navigation Items (الرئيسية)

1. **الرئيسية** - Dashboard Home
2. **المشتركين** - Subscribers Management
3. **الاشتراكات** - Subscriptions
4. **المدفوعات** - Payments
5. **التحليلات** - Analytics
6. **المستخدمين** - Users
7. **سجل العمليات** - Activity Logs
8. **الإعدادات** - Settings

#### Features

- Active state styling with orange background and shadow
- Hover effects with smooth transitions
- Icons from lucide-react
- Mobile toggle button (hamburger menu)
- Quick action buttons at bottom (Settings, Logout)
- Animated entrance for navigation items
- Full height responsive sidebar

### Main Dashboard Page (`app/page.tsx`)

#### Layout Structure

```
┌─────────────────────────────────────────┐
│         Main Content Area               │ Sidebar
│                                         │ (RTL)
│  ┌─────────────────────────────────┐   │
│  │ Header Section                  │   │
│  │ لوحة التحكم                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─┐ ┌─┐ ┌─┐ ┌─┐                      │
│  │ │ │ │ │ │ │ │  Stat Cards         │
│  └─┘ └─┘ └─┘ └─┘                      │
│                                         │
│  ┌──────────────────┐ ┌────────────┐   │
│  │ Recent Activity  │ │ Quick Links│   │
│  └──────────────────┘ └────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Welcome Banner                  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

#### Key Components

1. **Header Section**
   - Large title: "لوحة التحكم" (Dashboard)
   - Subtitle with welcome message

2. **Statistics Cards** (4-column grid)
   - إجمالي المشتركين (Total Subscribers)
   - الاشتراكات النشطة (Active Subscriptions)
   - إجمالي الإيرادات (Total Revenue)
   - معدل الاحتفاظ (Retention Rate)
   - Each with percentage change indicator

3. **Activity Section**
   - Recent subscriber activity
   - Timestamp information
   - Activity type badges

4. **Quick Links**
   - Add new subscriber
   - Create subscription
   - Sales reports
   - Easy action buttons

5. **Welcome Banner**
   - Brand message
   - Gradient orange background

## 🛠️ Tech Stack

- **Framework**: Next.js 16.2.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion 12.38.0
- **Icons**: Lucide React
- **UI Components**: HeroUI (for future enhancement)
- **Font**: Cairo (Arabic-optimized font)

## 📦 Installation

All dependencies are already installed:

```bash
npm install
```

If you need to reinstall:

```bash
npm install next@16.2.6 react@19.2.4 react-dom@19.2.4
npm install @heroui/react framer-motion lucide-react
npm install -D tailwindcss@4 @tailwindcss/postcss typescript @types/react @types/node
```

## 🚀 Running the Dashboard

### Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## 📱 Responsive Breakpoints

- **Mobile**: Full-screen sidebar with hamburger toggle
- **Tablet (md)**: Sidebar appears with menu button
- **Desktop (lg+)**: Sidebar always visible on the right

## 🎯 Color Scheme

- **Primary**: Orange (#f97316)
- **Background**: Black (#000000)
- **Dark Slate**: #0f172a to #1e293b (gradient backgrounds)
- **Text**: White (#ffffff), Gray (#94a3b8 for secondary)
- **Borders**: Subtle gray (#334155)

## ✨ Animation Details

### Sidebar
- Mobile slide-in from right: 300ms
- Nav item stagger: 50ms per item
- Hover effects: 200ms smooth transitions

### Main Content
- Fade in animation: 500ms
- Item entrance stagger: 100ms per item
- Card hover lift: 4px upward

### Interactive Elements
- Button scale: 1.02x on hover, 0.98x on tap
- Icon animations: Smooth color transitions

## 🔧 Customization Guide

### Changing Accent Color

1. Update in `globals.css`:
   ```css
   --accent: #your-color;
   ```

2. Update Tailwind classes in components (search for `orange-600`, `orange-700`, etc.)

### Adding New Navigation Items

Edit `components/layout/Sidebar.tsx` in the `navItems` array:

```typescript
{
  id: 'new-item',
  label: 'الاسم بالعربية',
  href: '/dashboard/path',
  icon: <IconComponent size={20} />,
}
```

### Modifying Dashboard Stats

Edit the `statCards` array in `app/page.tsx` to customize metrics and data.

## 📐 Component Structure

```
joker-dashboard/
├── app/
│   ├── layout.tsx          # Root layout with RTL setup
│   ├── page.tsx            # Dashboard home page
│   └── globals.css         # Global styles and animations
├── components/
│   └── layout/
│       └── Sidebar.tsx     # Reusable sidebar component
├── public/                 # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts      # Tailwind configuration
```

## 🎭 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## 📝 Notes

- All text is in Arabic (العربية) with proper RTL support
- The layout automatically handles RTL via HTML `dir="rtl"` attribute
- Cairo font is imported from Google Fonts with Arabic subset
- Framer Motion provides smooth, performant animations
- Tailwind CSS handles all styling with utility classes

## 🚀 Future Enhancements

- Add HeroUI component integration for modals and dropdowns
- Create dashboard pages for each sidebar item
- Add dark/light theme toggle
- Implement real data integration
- Add notification system
- Create user profile dropdown
- Add search functionality

## 📞 Support

For customization or modifications, refer to:
- [Next.js Documentation](https://nextjs.org)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Framer Motion Documentation](https://www.framer.com/motion)
- [Lucide Icons](https://lucide.dev)
