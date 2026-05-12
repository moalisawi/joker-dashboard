# Architecture Guide — Joker Dashboard

> Last updated: 2026-05-12
> Stack: Next.js 16 (App Router) · React 19 · Firebase 12 · Firestore · Zustand 5 · React Query 5 · Zod 4 · Tailwind 4 · HeroUI

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [Feature Boundaries](#2-feature-boundaries)
3. [Firestore Collections](#3-firestore-collections)
4. [Naming Conventions](#4-naming-conventions)
5. [Services vs Hooks](#5-services-vs-hooks)
6. [State Management Rules](#6-state-management-rules)
7. [Permission Flow](#7-permission-flow)
8. [API Route Policy](#8-api-route-policy)
9. [Validation Strategy](#9-validation-strategy)
10. [Soft Delete Policy](#10-soft-delete-policy)
11. [Audit Layer](#11-audit-layer)
12. [Migration Roadmap](#12-migration-roadmap)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Folder Structure

```
joker-dashboard/
├── app/                      Next.js App Router pages & API routes
│   ├── api/                  Server-side API handlers (see §8)
│   └── (pages)/              Route segments
│
├── components/               Shared, reusable UI components
│   ├── layout/               App-wide shell (AuthProvider, Sidebar, QueryProvider…)
│   ├── ui/                   Generic UI primitives (buttons, modals, badges…)
│   ├── stats/                Dashboard metric widgets
│   ├── subscribers/          Subscriber-domain UI (table, modals)
│   ├── notifications/        Notification UI
│   └── logs/                 Audit log UI
│
├── features/                 ← Feature-based domain modules (NEW)
│   ├── subscribers/
│   │   ├── schemas/          Zod input schemas
│   │   ├── hooks/            React Query hooks
│   │   └── index.ts          Public barrel export
│   ├── payments/
│   │   ├── schemas/
│   │   └── index.ts
│   ├── users/                (future)
│   ├── analytics/            (future)
│   └── notifications/        (future)
│
├── services/                 Pure Firestore/domain operations (no React)
├── hooks/                    Legacy hooks (migrate to features/ over time)
├── store/                    Zustand stores (auth, notifications, theme only)
├── lib/                      Shared infrastructure utilities
├── types/                    TypeScript domain models
├── constants/                Shared enums & string constants
└── emails/                   Email templates (Resend)
```

### Rules

- A **feature** owns its schemas, query hooks, and optionally domain-local services.
- Cross-feature data is fetched from `services/`, not imported from another feature's internals.
- `components/` holds UI; data-fetching lives in `features/` or `hooks/`.
- `lib/` holds pure infrastructure (Firebase clients, utils, auth helpers). No business logic here.

---

## 2. Feature Boundaries

| Feature | Owns | Does NOT own |
|---|---|---|
| `subscribers` | subscriber CRUD, filter, lifecycle state | payments, refunds, analytics |
| `payments` | payment recording, refund creation | subscriber state mutation |
| `users` | user profiles, role assignment | authentication flow |
| `analytics` | aggregation queries, exports | raw subscriber/payment data |
| `notifications` | in-app notification state | audit log writes |
| `auth` | Firebase Auth, session, provisioning | user CRUD |

---

## 3. Firestore Collections

All collection names are defined in `constants/collections.ts`. **Never hardcode a collection string.**

```typescript
import { COLLECTIONS } from "@/constants";
collection(db, COLLECTIONS.SUBSCRIBERS)
```

| Constant | Collection | Purpose |
|---|---|---|
| `COLLECTIONS.SUBSCRIBERS` | `subscribers` | Core subscription records |
| `COLLECTIONS.USERS` | `users` | User profiles & permissions |
| `COLLECTIONS.PAYMENTS` | `payments` | Immutable payment transactions |
| `COLLECTIONS.REFUNDS` | `refunds` | Refund records |
| `COLLECTIONS.AUDIT_LOGS` | `auditLogs` | Full audit trail |
| `COLLECTIONS.NOTIFICATIONS` | `notifications` | In-app notifications |
| `COLLECTIONS.MONTHLY_ANALYTICS` | `monthlyAnalytics` | Pre-aggregated monthly stats |

### Document conventions

Every document should conform to `BaseDocument` (`types/base.ts`):

```typescript
interface BaseDocument {
  id: string;
  createdAt: Timestamp;   // serverTimestamp() on create
  updatedAt: Timestamp;   // serverTimestamp() on every write
  createdBy?: string;     // uid of actor
  updatedBy?: string;
  deleted?: boolean;      // soft delete flag
  deletedAt?: Timestamp;
  deletedBy?: string;
}
```

- Use `serverTimestamp()` for all timestamp writes — never `new Date()`.
- Normalize Firestore Timestamps to JS Dates only at the UI boundary.

---

## 4. Naming Conventions

| Layer | Convention | Example |
|---|---|---|
| Services | `camelCase` object with verb methods | `subscriberService.getAll()` |
| Hooks (legacy) | `useCamelCase` | `useSubscribers()` |
| Hooks (React Query) | `use<Entity>Query` / `use<Action>Mutation` | `useSubscribersQuery()`, `useCreateSubscriberMutation()` |
| Zod schemas | `camelCase` + `Schema` suffix | `createSubscriberSchema` |
| Zod inferred types | `PascalCase` + `Input` suffix | `CreateSubscriberInput` |
| Query key factories | `<entity>Keys` | `subscriberKeys.list()` |
| Constants | `SCREAMING_SNAKE_CASE` | `COLLECTIONS.SUBSCRIBERS` |
| API operations | `camelCase` string | `"createSubscriber"`, `"freezeSubscription"` |
| Firestore fields | `camelCase` | `createdAt`, `subscriberName` |

---

## 5. Services vs Hooks

### Services (`services/`)

- **Pure Firestore/domain operations only.**
- No React imports. No UI state. No hooks.
- Accept plain data, return plain data or void.
- May call other services (e.g., `auditService.track()` inside a mutation service).

```typescript
// ✅ Good
subscriberService.getById(id): Promise<Subscriber | null>

// ❌ Bad — React logic belongs in hooks
subscriberService.getAll = () => { useState(...) }
```

### Hooks (`features/<domain>/hooks/` or legacy `hooks/`)

- Wrap services with React Query (`useQuery`, `useMutation`).
- Own loading/error states, caching, invalidation, and optimistic updates.
- May subscribe to Firestore real-time listeners to update the React Query cache.

```typescript
// Pattern: real-time listener → queryClient.setQueryData()
useEffect(() => {
  const unsub = onSnapshot(q, (snap) => {
    queryClient.setQueryData(queryKey, normalize(snap));
  });
  return () => unsub();
}, [user?.uid]);
```

### Migration path

The legacy `hooks/` directory uses raw `useState` + `onSnapshot`. New code should use the `features/<domain>/hooks/` pattern. Migrate incrementally — never break existing callsites.

---

## 6. State Management Rules

| What | Where | Why |
|---|---|---|
| Auth user, permissions | Zustand (`authStore`) | Global, synchronous access across components |
| In-app notifications | Zustand (`notificationStore`) | Real-time feed, shared globally |
| Theme (light/dark) | Zustand (`themeStore`) | UI preference, persisted |
| Server/Firestore data | React Query | Caching, deduplication, stale-while-revalidate |
| Component-local UI state | `useState` / `useReducer` | Doesn't need global visibility |

**Do not** put Firestore documents into Zustand. Server state belongs in React Query.

### React Query cache keys

Defined in `features/<domain>/hooks/queryKeys.ts`:

```typescript
subscriberKeys.all()          → ["subscribers"]
subscriberKeys.lists()        → ["subscribers", "list"]
subscriberKeys.list(uid)      → ["subscribers", "list", uid]
subscriberKeys.detail(id)     → ["subscribers", "detail", id]
```

Invalidating a parent key cascades to all children.

---

## 7. Permission Flow

### Dual-layer system

**Layer 1 — Flat permissions** (backward-compatible, stored in `lib/permissions.ts`):

```typescript
can("canViewAll")       // authStore
can("canManageUsers")
```

**Layer 2 — Granular permissions** (RBAC, stored in Firestore on each user):

```typescript
perm("subscribers", "delete")     // authStore
perm("payments", "refund")
perm("users", "changeRoles")
```

### Server-side check

Every API route that mutates data calls `verifyServerUser()` + `hasServerPermission()` before any write.

### Role defaults

Defined in `lib/permissions.ts` as `DEFAULT_GRANULAR_PERMISSIONS`. If a user has no `granularPermissions` in Firestore, role defaults apply.

### Role hierarchy

`owner` > `admin` > `employee`. An actor can only manage users with a lower rank.

---

## 8. API Route Policy

Use `app/api/` routes **only** for:

| Use case | Example |
|---|---|
| Financial mutations | `addPayment`, `refundPayment`, `withdrawSubscriber` |
| Permission-guarded writes | `setRole`, `setGranularPermissions` |
| Audit-critical operations | Any write that must produce an audit log server-side |
| Bulk operations | Batch imports, recalculations |
| Sensitive server validation | Operations requiring Admin SDK |

**Do not** create API routes for:
- Read-only Firestore queries (use services/hooks directly)
- Simple client-side state changes

### Operation dispatch pattern

All routes use a POST body with an `operation` discriminator:

```typescript
POST /api/subscriber-operations
{ "operation": "freezeSubscription", "subscriberId": "...", ... }
```

---

## 9. Validation Strategy

Validation uses **Zod** (`constants/`-aware schemas in `features/<domain>/schemas/`).

### Where to validate

| Boundary | Tool | Example |
|---|---|---|
| Form input (client) | React Hook Form + Zod resolver | `useForm({ resolver: zodResolver(createSubscriberSchema) })` |
| API route payload (server) | `schema.safeParse(body)` | Validate before any Firestore write |
| Firestore read normalization | Zod `.partial().passthrough()` | Strip unknown fields on read |

### Schema location

```
features/
  subscribers/schemas/subscriber.schema.ts   createSubscriberSchema, updateSubscriberSchema
  payments/schemas/payment.schema.ts         addPaymentSchema, createRefundSchema
```

### Incremental adoption

Existing forms using React Hook Form without Zod are valid. Add Zod resolvers to new forms and when touching existing ones.

---

## 10. Soft Delete Policy

**Hard deletes are prohibited** except for developer/admin operations on test data.

All document deletions go through `softDelete()` in `lib/softDelete.ts`:

```typescript
import { softDelete, excludeDeleted } from "@/lib/softDelete";

// Delete
await softDelete(COLLECTIONS.SUBSCRIBERS, id, user.uid);

// Query (excludes deleted docs)
const q = excludeDeleted(collection(db, COLLECTIONS.SUBSCRIBERS));
```

The `deleted: true` flag is set server-side in API routes. Reads in hooks/services use `excludeDeleted()` to filter them out automatically.

---

## 11. Audit Layer

Every mutation that changes business data must produce an audit log via `auditService`.

### Preferred API — `auditService.track()`

```typescript
await auditService.track({
  actor:      user,
  action:     "subscriber_renewed",
  entity:     "subscriber",
  entityId:   subscriber.id,
  entityName: subscriber.name,
  before:     { expiryDate: previousExpiry },
  after:      { expiryDate: newExpiry },
  financialData: { amountUSD, currency, impactType: "positive" },
  metadata:   { renewalNumber },
});
```

`track()` automatically:
- derives `category` and `severity` from the action key
- computes `changedFields` by diffing `before` and `after`
- fires a notification via `notificationService.createFromAuditAction()`

### Action keys

Defined as keys in `ACTION_SEVERITY` / `ACTION_CATEGORY` maps inside `audit.service.ts`.

### Legacy domain methods

`auditService.logSubscriberCreated()`, `logPaymentCreated()`, etc. remain for backward compatibility. New code should prefer `track()`.

---

## 12. Migration Roadmap

Ordered by risk (lowest first):

| Step | What | Risk |
|---|---|---|
| ✅ 1 | `constants/` layer | None — additive |
| ✅ 2 | `types/base.ts` BaseDocument | None — additive |
| ✅ 3 | `lib/softDelete.ts` | None — additive |
| ✅ 4 | React Query install + QueryProvider | None — wrapper only |
| ✅ 5 | Subscriber React Query hooks | Low — parallel to legacy hook |
| ✅ 6 | Zod schemas (subscribers, payments) | None — additive |
| ✅ 7 | `auditService.track()` | None — additive wrapper |
| 🔲 8 | Adopt `COLLECTIONS.*` constants in services | Low — rename only |
| 🔲 9 | Add Zod validation to API routes (`subscriber-operations`) | Low |
| 🔲 10 | Migrate page components from `useSubscribers` → `useSubscribersQuery` | Medium |
| 🔲 11 | Adopt `excludeDeleted()` in all list queries | Low |
| 🔲 12 | Migrate payments/users hooks to React Query pattern | Medium |
| 🔲 13 | Create `features/users/` and `features/analytics/` | Low |
| 🔲 14 | Add `BaseDocument` conformance to Subscriber/Payment types | Low |
| 🔲 15 | Unit tests for services | Low |

---

## 13. Testing Strategy

### Layer priorities

| Layer | Tool | What to test |
|---|---|---|
| Services | Vitest + Firestore emulator | `getAll()`, `getById()`, filter queries, soft-delete behavior |
| Zod schemas | Vitest (no emulator needed) | Valid inputs, invalid inputs, edge cases |
| React Query hooks | Vitest + React Testing Library + mock QueryClient | loading state, data shape, mutation side-effects |
| API routes | Supertest + emulator | Permission checks, operation dispatch, audit log creation |
| Critical business flows | Integration test (emulator) | Freeze/resume cycle, renewal with payment, withdrawal + refund |

### Recommended test file co-location

```
services/
  subscribers.service.ts
  subscribers.service.test.ts    ← unit tests live next to the service

features/
  subscribers/
    schemas/
      subscriber.schema.ts
      subscriber.schema.test.ts  ← schema validation tests
    hooks/
      useSubscribersQuery.ts
      useSubscribersQuery.test.tsx
```

### What NOT to test

- Firestore real-time listener plumbing (covered by Firestore SDK's own tests)
- UI rendering details that aren't business logic
- Zod internals
