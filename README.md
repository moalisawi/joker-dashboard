# Joker Dashboard

A full-featured Arabic-RTL subscription management system built with Next.js 16, Firebase, and React 19.

---

## Latest Changes — 2026-05-26

### Security Hardening
- **Firestore rules** — employees now have row-level scoping: they can only read subscribers where they are the `convincedBy` party. Uses `convincedByUid` (UID-based, tamper-proof) for new records, with a name-based fallback for legacy records.
- **Rate limiting** — upgraded from in-process to Upstash Redis (shared across all serverless instances). Configure via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Falls back to in-memory for local dev.
- **Env validation** — `lib/env.ts` exposes Zod-backed checks (`validateClientEnv`, `validateServerEnv`, `assertServerEnv`). They are explicit calls, not a module-load side effect: `next build` imports every route module, so throwing at import would fail CI builds, which run without secrets deliberately. A deployment missing Admin credentials is caught at request time by `hasAdminCredentials()`, and the mutation routes answer 503.

### `convincedByUid` End-to-End Migration
- All new subscriber records now store `convincedByUid` (Firebase UID) alongside the `convincedBy` display name.
- The UID is resolved automatically: clients send the name, the API looks up the UID from the users collection.
- Payment records (`payments` collection) also carry `convincedByUid` so employee-scoped analytics work correctly.
- `useSubscribers` hook now queries by UID for employees (survives name changes).

### Bug Fixes
- **Subscribers table** — header/row column mismatch when revenue column was hidden for employees is fixed.
- **Confirm dialogs** — replaced all native `confirm()` calls with the `ConfirmDialog` component (accessible, styled, consistent with the rest of the UI).
- **AdvancedStats** — removed hardcoded employee names from `EMP_COLORS`; chart bar colors are now assigned dynamically by index.
- **`filterByPeriod`** — null date handling is now explicit (items without dates are intentionally excluded from period filters).
- **`useSubscribers`** — initial `getDocs` now applies the same `deleted !== true` filter that the real-time snapshot handler already had.

### Indexes
- Added `convincedByUid` composite indexes to `firestore.indexes.json` for both `subscribers` and `payments` collections.

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
| View all subscribers | ✓ | ✓ | own only |
| View revenue | ✓ | ✓ | — |
| Create / Edit | ✓ | ✓ | ✓ |
| Delete | ✓ | — | — |
| Withdraw | ✓ | ✓ | — |
| Manage users | ✓ | — | — |
| View audit logs | ✓ | ✓ | — |
| Manage payment methods | ✓ | ✓ | — |

Employee sub-roles (`team_leader`, `sales`, `followup`) carry their own granular permission sets defined in [`lib/permissions.ts`](lib/permissions.ts).

> **Row-level security:** Employees can only read subscriber records where they are the `convincedBy` party — enforced at the Firestore rules layer, not just the UI. New records use `convincedByUid` (Firebase UID) for tamper-proof attribution; legacy records fall back to name matching.

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

# Option A (recommended — base64 encoded, no newline escaping needed)
FIREBASE_PRIVATE_KEY_B64=<base64 of the full PEM key>

# Option B (raw PEM — keep literal \n sequences, wrap in double quotes)
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Resend — transactional email
RESEND_API_KEY=
RESEND_FROM_EMAIL=Joker Dashboard <noreply@yourdomain.com>

# Upstash Redis — distributed rate limiting (optional; falls back to in-memory if absent)
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx==
```

> **Tip:** Generate `FIREBASE_PRIVATE_KEY_B64` with: `base64 -w 0 serviceAccountKey.json | pbcopy` (macOS) or paste the key into an online base64 encoder.

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
API routes use `lib/rateLimit.ts` to throttle abusive callers. When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, limits are enforced via Upstash Redis (shared across all serverless instances — production-safe). Falls back to an in-process fixed-window counter for local development.

### Audit Logging
Every privileged operation (create, edit, delete, withdraw, role change) writes a record to the `auditLogs` Firestore collection via `lib/auditLog.ts`. Logs are immutable — no update or delete is permitted by the rules.

### Environment Variables
- `NEXT_PUBLIC_*` vars are safe to expose (they are Firebase client credentials, protected by Firestore rules and authorized domains)
- `FIREBASE_PRIVATE_KEY_B64` (base64-encoded) or `FIREBASE_PRIVATE_KEY` (raw PEM with `\n`) for the Admin SDK private key
- `RESEND_API_KEY` is server-only — never prefix it with `NEXT_PUBLIC_`
- Server env vars have Zod schemas in `lib/env.ts`, validated on demand rather than at startup — see above for why. Missing Admin credentials surface as a 503 from the mutation routes; missing `NEXT_PUBLIC_FIREBASE_*` surface on the login page, since `lib/firebase.ts` detects the CI placeholder it would otherwise ship silently
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
