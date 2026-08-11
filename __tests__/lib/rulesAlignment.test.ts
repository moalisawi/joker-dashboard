/**
 * Guards that mirror firestore.rules must not drift from it.
 *
 * The rules are the authority. When a page gates an action on a *permission*
 * while the matching rule is written in terms of a *role*, the owner can
 * delegate that permission and hand someone buttons that Firestore then rejects
 * with permission-denied. These tests pin each guard to the rule it mirrors.
 *
 * If a rule in firestore.rules is widened, widen the guard and update the test
 * — that is the intended way for these to change.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canManageTeams,
  canDeleteTeams,
  canViewSessions,
  canReadUserDirectory,
  canManageUsers,
} from '@/lib/permissionGuards'
import { DEFAULT_GRANULAR_PERMISSIONS } from '@/lib/permissions'
import type { UserProfile, GranularPermissions, Role } from '@/types'

function user(role: Role, granularPermissions?: GranularPermissions): UserProfile {
  return { uid: 'u1', email: 'u@x.test', name: 'U', role, active: true, granularPermissions } as UserProfile
}

/** An account explicitly granted users.manage — what an owner delegates. */
function withUsersManage(role: Role): UserProfile {
  const base = DEFAULT_GRANULAR_PERMISSIONS[role]
  return user(role, { ...base, users: { ...base.users, manage: true } })
}

describe('guards mirror firestore.rules', () => {
  describe('teams — rule: allow create, update: if isOwner()', () => {
    it('allows the owner', () => {
      expect(canManageTeams(user('owner'))).toBe(true)
    })

    it('refuses admin and employee', () => {
      expect(canManageTeams(user('admin'))).toBe(false)
      expect(canManageTeams(user('employee'))).toBe(false)
    })

    // Regression: the page used to gate on canManageUsers. users.manage is
    // delegatable, isOwner is not — so a delegated admin saw create/rename/
    // deactivate controls and every save came back permission-denied.
    it('still refuses a non-owner who was granted users.manage', () => {
      const delegatedAdmin = withUsersManage('admin')
      const delegatedEmployee = withUsersManage('employee')

      // The old gate would have let both through...
      expect(canManageUsers(delegatedAdmin)).toBe(true)
      expect(canManageUsers(delegatedEmployee)).toBe(true)
      // ...the rule-aligned gate does not.
      expect(canManageTeams(delegatedAdmin)).toBe(false)
      expect(canManageTeams(delegatedEmployee)).toBe(false)
    })

    it('refuses a signed-out visitor', () => {
      expect(canManageTeams(null)).toBe(false)
    })
  })

  describe('teams delete — rule: allow delete: if false, soft-delete is an owner update', () => {
    it('is owner-only', () => {
      expect(canDeleteTeams(user('owner'))).toBe(true)
      expect(canDeleteTeams(user('admin'))).toBe(false)
      expect(canDeleteTeams(withUsersManage('admin'))).toBe(false)
      expect(canDeleteTeams(null)).toBe(false)
    })
  })

  describe('sessions — rule: allow read: if isStaff()', () => {
    it('admits staff only, and is not delegatable', () => {
      expect(canViewSessions(user('owner'))).toBe(true)
      expect(canViewSessions(user('admin'))).toBe(true)
      expect(canViewSessions(user('employee'))).toBe(false)
      expect(canViewSessions(withUsersManage('employee'))).toBe(false)
      expect(canViewSessions(null)).toBe(false)
    })
  })

  describe('user directory — rule: allow read: if self || isStaff()', () => {
    it('admits staff only', () => {
      expect(canReadUserDirectory(user('owner'))).toBe(true)
      expect(canReadUserDirectory(user('admin'))).toBe(true)
      expect(canReadUserDirectory(user('employee'))).toBe(false)
      expect(canReadUserDirectory(null)).toBe(false)
    })

    // An employee granted users.manage would previously have passed the page
    // guard and then had every directory query denied.
    it('is not unlocked by users.manage', () => {
      const delegated = withUsersManage('employee')
      expect(canManageUsers(delegated)).toBe(true)
      expect(canReadUserDirectory(delegated)).toBe(false)
    })
  })

  describe('the default admin is genuinely restricted', () => {
    // hasServerPermission() only exempts the owner; admins are subject to their
    // granular permissions. The users page used to bypass that with
    // `|| role === "admin"`, showing controls the API answered with 403.
    it('does not hold users.manage by default', () => {
      expect(DEFAULT_GRANULAR_PERMISSIONS.admin.users.manage).toBe(false)
      expect(canManageUsers(user('admin'))).toBe(false)
    })

    it('holds it once an owner grants it', () => {
      expect(canManageUsers(withUsersManage('admin'))).toBe(true)
    })
  })
})

/**
 * subscriberNotes: the update rule and the service that writes it.
 *
 * The rule restricts an author to the fields an edit or a soft delete actually
 * touches. Without that clause an author could rewrite subscriberId or
 * convincedByUid on their own note — moving it onto someone else's timeline, or
 * re-pointing the very field the read rule matches on, making the note readable
 * by whoever they named.
 *
 * These read firestore.rules and subscriberNotes.service.ts as text rather than
 * asserting a remembered copy of them, so widening one without the other fails
 * here instead of in production.
 */
describe('subscriberNotes rule matches the service', () => {
  const ROOT = resolve(__dirname, '..', '..')
  const rules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8')
  const service = readFileSync(resolve(ROOT, 'services/subscriberNotes.service.ts'), 'utf8')

  /** The subscriberNotes block, from its match line to the closing brace. */
  const notesBlock = (() => {
    const start = rules.indexOf('match /subscriberNotes/')
    expect(start).toBeGreaterThan(-1)
    return rules.slice(start, rules.indexOf('match /', start + 10))
  })()

  /** Field names inside the update rule's hasOnly([...]). */
  const allowedUpdateFields = (() => {
    const match = notesBlock.match(/hasOnly\(\[([^\]]*)\]\)/)
    expect(match).not.toBeNull()
    return (match![1].match(/'([^']+)'/g) ?? []).map((s) => s.replace(/'/g, ''))
  })()

  it('restricts updates to a closed set of fields', () => {
    expect(allowedUpdateFields.length).toBeGreaterThan(0)
  })

  it.each(['authorId', 'subscriberId', 'subscriberName', 'convincedByUid', 'createdAt', 'noteType'])(
    'does not let an author rewrite %s',
    (field) => {
      expect(allowedUpdateFields).not.toContain(field)
    }
  )

  it('allows exactly what edit() and delete() write', () => {
    // edit(): content + updatedAt. delete(): deleted, deletedAt, deletedBy, updatedAt.
    expect(new Set(allowedUpdateFields)).toEqual(
      new Set(['content', 'updatedAt', 'deleted', 'deletedAt', 'deletedBy'])
    )
  })

  it('keeps update author-only', () => {
    expect(notesBlock).toMatch(/allow update:[\s\S]*resource\.data\.authorId/)
  })

  it('denies hard delete — deletion is soft-only', () => {
    expect(notesBlock).toMatch(/allow delete:\s*if false/)
  })

  it('scopes reads rather than allowing every active user', () => {
    // The rule used to be `allow read: if isAnyActive()`, which made the note a
    // way around the subscribers rule.
    expect(notesBlock).not.toMatch(/allow read:\s*if isAnyActive\(\)/)
    expect(notesBlock).toMatch(/convincedByUid/)
  })

  it('requires a creating employee to stamp their own uid', () => {
    expect(notesBlock).toMatch(/allow create:[\s\S]*authorId[\s\S]*request\.auth\.uid/)
  })

  it('writes no field on update that the rule would reject', () => {
    // Every `field: value` inside edit() and delete() must be permitted.
    for (const fn of ['async edit(', 'async delete(']) {
      const start = service.indexOf(fn)
      expect(start).toBeGreaterThan(-1)
      const body = service.slice(start, start + 600)
      const updateCall = body.slice(body.indexOf('updateDoc('), body.indexOf('});'))
      for (const [, field] of updateCall.matchAll(/^\s{4,}(\w+):/gm)) {
        expect(allowedUpdateFields).toContain(field)
      }
    }
  })

  it('names the backfill script that actually exists', () => {
    // The comment pointed at scripts/backfill-refund-convinced-by-uid.mjs,
    // which was never written; the real one covers both collections.
    const referenced = rules.match(/scripts\/[\w.-]+\.mjs/g) ?? []
    for (const path of referenced) {
      expect(existsSync(resolve(ROOT, path))).toBe(true)
    }
  })
})
