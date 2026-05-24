# Joker Dashboard

A full-featured Arabic-RTL subscription management system built with Next.js 16, Firebase, and React 19.

---

## Overview

Joker Dashboard is an internal operations platform for managing subscribers, payments, teams, and analytics. The UI is fully Arabic (RTL, `lang="ar" dir="rtl"`) with a role-based access control system that controls what each user can see and do.

---

## Features

| Area | Details |
|------|---------|
| Subscribers | Add, edit, freeze, renew, soft-delete, export CSV |
| Subscriptions | Package tracking (ذهبية / فضية), payment methods, net USD amounts |
| WhatsApp Leads | Incoming lead capture + conversation timeline |
| Analytics | Revenue charts, package breakdown, trend lines (Recharts) |
| Reports | Date-range financial and subscriber reports with export |
| Notifications | Real-time bell with unread badge |
| Audit Logs | Full operation log with category, severity, actor, entity filters |
| Sessions | Live session monitor (online users, login history, failed attempts) |
| Teams & Employees | Team management, employee roles, per-employee sales leaderboard |
| Payment Methods | Configurable payment method list |
| Calendar | Monthly subscriber calendar — click any day for revenue + subscriber detail |
| Access Control | 3 roles × granular permissions; role hierarchy enforced on every action |
| Email | Transactional email via Resend |

---

## Architecture

```
Browser (Next.js App Router, React 19)
  │
  ├── Zustand stores        → auth, notifications, search, employee cards
  ├── TanStack React Query  → server-state, caching, background refetch
  ├── Custom hooks          → useAuditLogs, useSubscribers, useRealtimeMetrics …
  ├── Components            → layout / subscribers / calendar / logs / guide …
  │
  └── Firebase SDK (client)
        ├── Firestore        → subscribers, users, teams, logs, sessions, leads
        ├── Realtime DB      → online presence / live session counter
        ├── Auth             → email+password, session cookies
        └── Storage          → file uploads

Server (Next.js API Routes / Firebase Functions)
  ├── firebase-admin SDK   → token verification, privileged writes
  ├── Firestore Rules      → defense-in-depth security
  └── Resend               → transactional email
```

### Data flow

```
Page → Hook → Firestore/RTDB → Zustand/React Query cache → UI
```

Server-side API routes (`app/api/`) handle operations that require elevated privileges (admin SDK) — the client SDK is used only for reads and non-privileged writes.

---

## Roles & Permissions

Three auth roles, enforced both client-side (UI gates) and server-side (Firestore rules + API checks):

| Permission | owner | admin | employee |
|-----------|-------|-------|----------|
| View all subscribers | ✓ | ✓ | ✓ |
| View revenue | ✓ | ✓ | — |
| Create / Edit | ✓ | ✓ | ✓ |
| Delete | ✓ | — | — |
| Withdraw | ✓ | ✓ | — |
| Manage users | ✓ | — | — |
| View audit logs | ✓ | ✓ | — |
| Manage payment methods | ✓ | ✓ | — |

Employee sub-roles (`team_leader`, `sales`, `followup`) carry their own granular permission sets defined in [`lib/permissions.ts`](lib/permissions.ts).

---

## Folder Structure

```
joker-dashboard/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Dashboard (KPI cards + calendar)
│   ├── layout.tsx              # Root layout — RTL, Cairo font, providers
│   ├── globals.css             # Design system tokens (--primary, --surface …)
│   ├── login/
│   ├── subscribers/[id]/
│   ├── analytics/
│   ├── reports/
│   ├── logs/
│   ├── sessions/
│   ├── notifications/
│   ├── payment-methods/
│   ├── admin/
│   │   ├── employees/[id]/
│   │   └── teams/[id]/
│   ├── (pages)/whatsapp-leads/
│   └── api/                    # Server-side API routes (firebase-admin)
│
├── components/
│   ├── layout/                 # Sidebar, TopNav, ProtectedLayout, PageHeader
│   ├── subscribers/            # Table, modals, forms
│   ├── calendar/               # MonthlyCalendar
│   ├── logs/                   # AuditCard, AuditFilters, AuditAnalytics
│   ├── guide/                  # GuideContent (interactive user guide)
│   └── ui/                     # Shared primitives
│
├── hooks/                      # Custom React hooks
│   ├── useAuditLogs.ts
│   ├── useSubscribers.ts
│   ├── useRealtimeMetrics.ts
│   └── …
│
├── lib/                        # Pure utilities + Firebase wrappers
│   ├── firebase.ts             # Client SDK init
│   ├── auth.ts                 # Auth helpers
│   ├── firestore.ts            # Firestore helpers
│   ├── serverFirestore.ts      # Admin SDK Firestore
│   ├── serverAuth.ts           # Admin SDK Auth
│   ├── permissions.ts          # Role/permission definitions
│   ├── auditLog.ts             # Audit log writer
│   ├── sessionLogger.ts        # Session tracking
│   ├── rateLimit.ts            # API rate limiting
│   └── utils.ts                # Formatting, date, Arabic months
│
├── store/                      # Zustand global stores
│   ├── authStore.ts            # User, role, can() helper
│   ├── notificationStore.ts    # Unread notification count
│   └── searchStore.ts
│
├── types/                      # TypeScript types (Subscriber, Role, …)
│
├── functions/                  # Firebase Cloud Functions (Node 22)
│
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json
├── firebase.json
└── .env.production.example     # Environment variable template
```

---

## Environment Variables

Copy `.env.production.example` to `.env.local` and fill in real values.

### Client-side (exposed to browser — `NEXT_PUBLIC_*`)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=        # Realtime DB for presence/sessions
```

### Server-side (never exposed to browser)

```env
# Firebase Admin SDK — service account credentials
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Resend — transactional email
RESEND_API_KEY=
RESEND_FROM_EMAIL=Joker Dashboard <noreply@yourdomain.com>
```

> **Note:** `FIREBASE_PRIVATE_KEY` must keep the literal `\n` newline sequences. Wrap the value in double quotes in the `.env` file.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Add environment variables
cp .env.production.example .env.local
# → fill in Firebase project credentials

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server (webpack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:coverage` | Jest with coverage report |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run seed:whatsapp` | Seed WhatsApp leads data |

---

## Deployment

### Firebase Hosting + Functions

```bash
# Build Next.js
npm run build

# Deploy everything (hosting + functions + firestore rules)
firebase deploy --project joker-prod
```

### Firestore indexes

If queries fail with a "missing index" error, deploy the index definitions:

```bash
firebase deploy --only firestore:indexes --project joker-prod
```

### Cloud Functions

Functions live in `functions/` and run on **Node.js 22**. They are built and linted automatically before deploy via the `predeploy` hooks in `firebase.json`.

---

## Security Notes

### Firestore Rules
All data is protected by `firestore.rules`. The client SDK **cannot** bypass these rules. Server-side routes use the Admin SDK which has full access — all admin operations must validate the caller's identity using `serverAuth.ts` before writing.

### Authentication
- Firebase Auth (email + password)
- Session persistence is controlled via `auth.ts` (`browserSessionPersistence` or `browserLocalPersistence`)
- Session activity is logged to Firestore on login/logout via `sessionLogger.ts`
- Failed login attempts are tracked and surfaced on the Sessions page

### Rate Limiting
API routes use `lib/rateLimit.ts` to throttle abusive callers. Limits are enforced per IP using an in-memory sliding window (suitable for single-instance deployments; use Redis or Firestore for multi-instance).

### Audit Logging
Every privileged operation (create, edit, delete, withdraw, role change) writes a record to the `auditLogs` Firestore collection via `lib/auditLog.ts`. Logs are immutable — no update or delete is permitted by the rules.

### Environment Variables
- `NEXT_PUBLIC_*` vars are safe to expose (they are Firebase client credentials, protected by Firestore rules and authorized domains)
- `FIREBASE_PRIVATE_KEY` and `RESEND_API_KEY` are server-only — never prefix them with `NEXT_PUBLIC_`
- Never commit `.env.local` — it is in `.gitignore`

### Soft Deletes
Subscribers are never hard-deleted. `lib/softDelete.ts` marks records with `deletedAt` and `deletedBy`. UI filters hide soft-deleted records; the audit log retains the full history.

---

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| Framework | Next.js | 16.2.6 |
| UI | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| Animations | Framer Motion | 12 |
| Icons | Lucide React | latest |
| Charts | Recharts | 3 |
| Tables | TanStack Table | 8 |
| State | Zustand | 5 |
| Server state | TanStack React Query | 5 |
| Forms | React Hook Form + Zod | 7 / 4 |
| Backend | Firebase (Auth, Firestore, RTDB, Functions, Storage) | 12 |
| Email | Resend | 6 |
| Notifications | Sonner | 2 |
| Testing | Jest + Playwright | 29 / 1.48 |
