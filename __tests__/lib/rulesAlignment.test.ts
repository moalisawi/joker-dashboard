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
