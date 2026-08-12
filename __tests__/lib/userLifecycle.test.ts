/**
 * @jest-environment node
 *
 * Node, not jsdom: these exercise API-route guards, which take a `Request` and
 * return a `NextResponse`. jsdom provides neither, and importing next/server
 * under it throws before a single test runs.
 *
 * The user lifecycle: what state an account is in, who may move it, and what
 * moves with it.
 *
 * Three failures this pins down, each of which shipped at some point:
 *
 *  1. Three fields answer "is this account usable?" — `status`, the legacy
 *     boolean `active`, and `deleted` — and they disagree. The old toggle wrote
 *     two of them, so a reactivated account showed as نشط everywhere while
 *     `status: "disabled"` kept verifyServerUser() and firestore.rules refusing
 *     it. resolveAccountStatus() is now the only reader.
 *  2. Every lifecycle route reimplemented its own preamble, and they diverged:
 *     `delete` refused to touch another owner, `deactivate` did not.
 *  3. Transferring assigned work is defined by a fixed list of scopes. A scope
 *     naming a field that does not exist would count zero forever and quietly
 *     tell whoever is archiving an account that there is nothing to move.
 */

// ── Admin SDK doubles ────────────────────────────────────────────────────────
// serverAuth and employeeAdminGuard both import firebase-admin at module load.

const mockVerifyIdToken   = jest.fn()
const mockDocGet          = jest.fn()
const mockUpdateUser      = jest.fn()
const mockRevokeTokens    = jest.fn()

jest.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: jest.fn(),
  cert: jest.fn(),
}))

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
    updateUser: mockUpdateUser,
    revokeRefreshTokens: mockRevokeTokens,
  }),
}))

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({ doc: () => ({ get: mockDocGet }) }),
  }),
  FieldValue: { serverTimestamp: () => 'ts', delete: () => 'del' },
}))

jest.mock('@/lib/serverFirestore', () => ({
  hasAdminCredentials: () => true,
  fsGet: jest.fn(),
  fsSet: jest.fn(),
  fsPatch: jest.fn(),
  fsAdd: jest.fn(),
}))

import { resolveAccountStatus, isArchivedStatus, ACCOUNT_STATUS_LABELS } from '@/lib/permissions'
import { SCOPE_META, TRANSFER_SCOPES } from '@/constants/transferScopes'
import { COLLECTIONS } from '@/constants/collections'
import {
  transferDataSchema, archiveEmployeeSchema, deactivateEmployeeSchema, createEmployeeSchema,
} from '@/features/users/schemas'
import { verifyServerUser } from '@/lib/serverAuth'
import { guardTargetedRoute } from '@/lib/employeeAdminGuard'
import { revokeAuthAccess, restoreAuthAccess } from '@/lib/revokeAccess'
import type { AccountStatus } from '@/types'

function request(token = 'tok'): Request {
  return new Request('https://x.test/api', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

/** The next users/{uid} read resolves to this document. */
function userDoc(data: Record<string, unknown> | null) {
  mockDocGet.mockResolvedValue(
    data === null ? { exists: false, data: () => undefined } : { exists: true, data: () => data }
  )
}

beforeEach(() => {
  mockVerifyIdToken.mockReset()
  mockDocGet.mockReset()
  mockUpdateUser.mockReset().mockResolvedValue(undefined)
  mockRevokeTokens.mockReset().mockResolvedValue(undefined)
})

describe('revokeAuthAccess', () => {
  it('disables the account and revokes live sessions', async () => {
    const res = await revokeAuthAccess('u1')
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { disabled: true })
    expect(mockRevokeTokens).toHaveBeenCalledWith('u1')
    expect(res).toEqual({ authDisabled: true, tokensRevoked: true, needsAttention: false })
  })

  /**
   * The dangerous partial failure: sign-in is blocked but an ID token already
   * in someone's browser stays valid for up to an hour. The old single
   * try/catch reported this as an all-or-nothing "authDisabled: false", which
   * is backwards — the account *was* disabled, and the live session was not.
   */
  it('reports a failed token revocation on its own', async () => {
    mockRevokeTokens.mockRejectedValue(new Error('network'))
    const res = await revokeAuthAccess('u1')
    expect(res).toEqual({ authDisabled: true, tokensRevoked: false, needsAttention: true })
  })

  it('still revokes tokens when disabling the account fails', async () => {
    mockUpdateUser.mockRejectedValue(new Error('not found'))
    const res = await revokeAuthAccess('u1')
    // The old code short-circuited here and never attempted the revocation.
    expect(mockRevokeTokens).toHaveBeenCalledWith('u1')
    expect(res).toEqual({ authDisabled: false, tokensRevoked: true, needsAttention: true })
  })

  it('never throws — Firestore is the authority and has already been written', async () => {
    mockUpdateUser.mockRejectedValue(new Error('boom'))
    mockRevokeTokens.mockRejectedValue(new Error('boom'))
    await expect(revokeAuthAccess('u1')).resolves.toMatchObject({ needsAttention: true })
  })
})

describe('restoreAuthAccess', () => {
  it('re-enables sign-in', async () => {
    expect(await restoreAuthAccess('u1')).toEqual({ authEnabled: true })
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { disabled: false })
  })

  it('reports failure rather than throwing', async () => {
    mockUpdateUser.mockRejectedValue(new Error('nope'))
    expect(await restoreAuthAccess('u1')).toEqual({ authEnabled: false })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('resolveAccountStatus', () => {
  it('lets deleted win over everything else', () => {
    expect(resolveAccountStatus({ deleted: true, status: 'active', active: true })).toBe('deleted')
  })

  it('prefers status over the legacy boolean when they disagree', () => {
    // The exact shape the old toggle left behind.
    expect(resolveAccountStatus({ status: 'disabled', active: true })).toBe('disabled')
    expect(resolveAccountStatus({ status: 'active', active: false })).toBe('active')
  })

  it('falls back to the boolean for documents predating status', () => {
    expect(resolveAccountStatus({ active: true })).toBe('active')
    expect(resolveAccountStatus({ active: false })).toBe('disabled')
    expect(resolveAccountStatus({})).toBe('disabled')
  })

  it('does not pass an unrecognised status through', () => {
    expect(resolveAccountStatus({ status: 'banana', active: true })).toBe('active')
  })

  it('labels every status it can return, including deleted', () => {
    const all: AccountStatus[] = ['active', 'suspended', 'disabled', 'pending', 'deleted']
    for (const s of all) expect(ACCOUNT_STATUS_LABELS[s]).toBeTruthy()
    expect(isArchivedStatus('deleted')).toBe(true)
    expect(isArchivedStatus('disabled')).toBe(false)
  })
})

describe('verifyServerUser', () => {
  it('refuses a disabled account', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1', email: 'u@x.test' })
    userDoc({ role: 'employee', status: 'disabled', active: false })
    expect(await verifyServerUser(request())).toBeNull()
  })

  it('refuses an archived account even while active is still true', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1' })
    userDoc({ role: 'admin', status: 'deleted', active: true })
    expect(await verifyServerUser(request())).toBeNull()
  })

  it('refuses a pending account — the invite state grants no access', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1' })
    userDoc({ role: 'employee', status: 'pending', active: false })
    expect(await verifyServerUser(request())).toBeNull()
  })

  it('admits the same account once reactivated', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1', email: 'u@x.test' })
    userDoc({ role: 'employee', status: 'active', active: true, employeeRole: 'sales' })
    const user = await verifyServerUser(request())
    expect(user).toMatchObject({ uid: 'u1', role: 'employee', active: true })
  })

  it('refuses a request with no bearer token', async () => {
    expect(await verifyServerUser(new Request('https://x.test/api', { method: 'POST' }))).toBeNull()
  })
})

describe('guardTargetedRoute', () => {
  /** The actor is read first, then the target — two sequential users/{uid} gets. */
  function actorThenTarget(actor: Record<string, unknown>, target: Record<string, unknown> | null) {
    mockVerifyIdToken.mockResolvedValue({ uid: actor.uid as string, email: 'a@x.test' })
    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => actor })
      .mockResolvedValueOnce(
        target === null ? { exists: false, data: () => undefined } : { exists: true, data: () => target }
      )
  }

  const OWNER = { uid: 'owner-1', role: 'owner', status: 'active', active: true, name: 'Owner' }

  it('refuses acting on your own account when forbidSelf is set', async () => {
    actorThenTarget(OWNER, OWNER)
    const res = await guardTargetedRoute(request(), 'owner-1', {
      permission: ['users', 'manage'], forbidSelf: true,
    })
    expect(res).toBeInstanceOf(Response)
    expect((res as Response).status).toBe(400)
  })

  it('refuses an admin acting on an owner', async () => {
    actorThenTarget(
      { uid: 'admin-1', role: 'admin', status: 'active', active: true },
      { uid: 'owner-2', role: 'owner', status: 'active', active: true, name: 'Other owner' }
    )
    const res = await guardTargetedRoute(request(), 'owner-2', {
      permission: ['users', 'activateAccounts'], protectOwner: true,
    })
    expect(res).toBeInstanceOf(Response)
    expect((res as Response).status).toBe(403)
  })

  it('refuses an employee even when the target outranks nobody', async () => {
    actorThenTarget(
      { uid: 'emp-1', role: 'employee', status: 'active', active: true, employeeRole: 'sales' },
      { uid: 'emp-2', role: 'employee', status: 'active', active: true }
    )
    const res = await guardTargetedRoute(request(), 'emp-2', { permission: ['users', 'manage'] })
    expect(res).toBeInstanceOf(Response)
    expect((res as Response).status).toBe(403)
  })

  it('answers 404 for a missing target', async () => {
    actorThenTarget(OWNER, null)
    const res = await guardTargetedRoute(request(), 'nobody', { permission: ['users', 'manage'] })
    expect(res).toBeInstanceOf(Response)
    expect((res as Response).status).toBe(404)
  })

  it('lets an owner through and resolves the target status', async () => {
    actorThenTarget(OWNER, {
      uid: 'emp-1', role: 'employee', name: 'Sara', status: 'disabled', active: false,
    })
    const res = await guardTargetedRoute(request(), 'emp-1', {
      permission: ['users', 'manage'], forbidSelf: true, protectOwner: true,
    })
    expect(res).not.toBeInstanceOf(Response)
    expect((res as { target: { name: string; status: string } }).target).toMatchObject({
      name: 'Sara', status: 'disabled',
    })
  })

  it('lets an admin through on activateAccounts but not on manage', async () => {
    const admin = { uid: 'admin-1', role: 'admin', status: 'active', active: true }
    const emp   = { uid: 'emp-1', role: 'employee', status: 'active', active: true, name: 'Sara' }

    actorThenTarget(admin, emp)
    const allowed = await guardTargetedRoute(request(), 'emp-1', {
      permission: ['users', 'activateAccounts'],
    })
    expect(allowed).not.toBeInstanceOf(Response)

    // users.manage sits above the admin ceiling, so it is owner-only.
    actorThenTarget(admin, emp)
    const refused = await guardTargetedRoute(request(), 'emp-1', { permission: ['users', 'manage'] })
    expect(refused).toBeInstanceOf(Response)
    expect((refused as Response).status).toBe(403)
  })
})

describe('transfer scopes', () => {
  it('names only fields that exist on the documents they target', () => {
    // Mirrors types/subscriber.ts and types/whatsapp-lead.ts. If a field is
    // renamed there and not here, the transfer silently moves nothing.
    expect(SCOPE_META.convincedByUid).toMatchObject({
      collection: COLLECTIONS.SUBSCRIBERS, field: 'convincedByUid',
    })
    expect(SCOPE_META.assignedSalesId).toMatchObject({
      collection: COLLECTIONS.SUBSCRIBERS, field: 'assignedSalesId',
    })
    expect(SCOPE_META.assignedNutritionistId).toMatchObject({
      collection: COLLECTIONS.SUBSCRIBERS, field: 'assignedNutritionistId',
    })
    expect(SCOPE_META.leadAssignedTo).toMatchObject({
      collection: COLLECTIONS.WHATSAPP_LEADS, field: 'assignedTo',
    })
  })

  it('carries a label and a hint for every scope', () => {
    for (const scope of TRANSFER_SCOPES) {
      expect(SCOPE_META[scope].label).toBeTruthy()
      expect(SCOPE_META[scope].hint).toBeTruthy()
    }
  })

  it('never touches payments, refunds or audit entries', () => {
    const touched = TRANSFER_SCOPES.map((s) => SCOPE_META[s].collection)
    expect(touched).not.toContain(COLLECTIONS.PAYMENTS)
    expect(touched).not.toContain(COLLECTIONS.REFUNDS)
    expect(touched).not.toContain(COLLECTIONS.AUDIT_LOGS)
  })
})

describe('transferDataSchema', () => {
  const base = { fromUid: 'a', toUid: 'b', scopes: ['convincedByUid'] }

  it('accepts a well-formed transfer', () => {
    expect(transferDataSchema.safeParse(base).success).toBe(true)
  })

  it('rejects an unknown scope rather than silently ignoring it', () => {
    expect(transferDataSchema.safeParse({ ...base, scopes: ['payments'] }).success).toBe(false)
    expect(transferDataSchema.safeParse({ ...base, scopes: ['convincedBy'] }).success).toBe(false)
  })

  it('rejects an empty scope list — a no-op transfer is a mistake, not a request', () => {
    expect(transferDataSchema.safeParse({ ...base, scopes: [] }).success).toBe(false)
  })

  it('rejects a transfer to the same account', () => {
    expect(transferDataSchema.safeParse({ ...base, toUid: 'a' }).success).toBe(false)
  })

  it('requires both ends', () => {
    expect(transferDataSchema.safeParse({ toUid: 'b', scopes: ['convincedByUid'] }).success).toBe(false)
    expect(transferDataSchema.safeParse({ fromUid: 'a', scopes: ['convincedByUid'] }).success).toBe(false)
  })
})

describe('archive and deactivate payloads', () => {
  it('accept an optional hand-over on the way out', () => {
    const parsed = deactivateEmployeeSchema.safeParse({
      uid: 'a', transferToUid: 'b', transferScopes: ['leadAssignedTo'],
    })
    expect(parsed.success).toBe(true)
  })

  it('reject an unknown transfer scope on the way out too', () => {
    expect(archiveEmployeeSchema.safeParse({
      uid: 'a', transferToUid: 'b', transferScopes: ['everything'],
    }).success).toBe(false)
  })

  it('treat keepAssignments as opt-in — absent is not consent', () => {
    const parsed = archiveEmployeeSchema.parse({ uid: 'a' })
    expect(parsed.keepAssignments ?? false).toBe(false)
  })
})

describe('createEmployeeSchema', () => {
  const base = {
    email: 'e@x.test', password: 'longenough1', fullName: 'اسم',
    employeeRole: 'sales', department: 'مبيعات',
  }

  it('defaults to an active account when no start state is given', () => {
    const parsed = createEmployeeSchema.parse(base)
    expect(parsed.initialStatus ?? 'active').toBe('active')
  })

  it('accepts pending — provisioned, and locked out until activated', () => {
    expect(createEmployeeSchema.safeParse({ ...base, initialStatus: 'pending' }).success).toBe(true)
  })

  it('rejects any other start state', () => {
    expect(createEmployeeSchema.safeParse({ ...base, initialStatus: 'deleted' }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...base, initialStatus: 'disabled' }).success).toBe(false)
  })

  it('still requires a password long enough to be usable', () => {
    expect(createEmployeeSchema.safeParse({ ...base, password: 'short' }).success).toBe(false)
  })
})
