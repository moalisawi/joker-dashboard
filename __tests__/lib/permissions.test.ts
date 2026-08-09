import {
  getPermissions,
  hasPermission,
  canDoGranular,
  DEFAULT_GRANULAR_PERMISSIONS,
  granularToFlat,
  canAssignRole,
  canManageRole,
  isKnownRole,
} from '@/lib/permissions'
import type { GranularPermissions, Role } from '@/types'

describe('Permissions', () => {
  describe('getPermissions', () => {
    it('grants owner all permissions', () => {
      const perms = getPermissions('owner')
      expect(perms.canViewAll).toBe(true)
      expect(perms.canCreate).toBe(true)
      expect(perms.canEdit).toBe(true)
      expect(perms.canDelete).toBe(true)
      expect(perms.canManageUsers).toBe(true)
    })

    it('grants admin most permissions except user management', () => {
      const perms = getPermissions('admin')
      expect(perms.canViewAll).toBe(true)
      expect(perms.canCreate).toBe(true)
      expect(perms.canManageUsers).toBe(false)
    })

    it('grants employee limited permissions', () => {
      const perms = getPermissions('employee')
      expect(perms.canViewAll).toBe(false)
      expect(perms.canCreate).toBe(true)
      expect(perms.canManageUsers).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('checks flat permissions correctly', () => {
      expect(hasPermission('owner', 'canViewAll')).toBe(true)
      expect(hasPermission('employee', 'canViewAll')).toBe(false)
      expect(hasPermission('employee', 'canCreate')).toBe(true)
      expect(hasPermission(undefined, 'canCreate')).toBe(false)
    })
  })

  describe('canDoGranular', () => {
    const gp: GranularPermissions = DEFAULT_GRANULAR_PERMISSIONS.employee

    it('allows permitted actions', () => {
      expect(canDoGranular('employee', gp, 'subscribers', 'view')).toBe(true)
      expect(canDoGranular('employee', gp, 'subscriptions', 'renew')).toBe(true)
    })

    it('denies restricted actions', () => {
      expect(canDoGranular('employee', gp, 'subscribers', 'delete')).toBe(false)
      expect(canDoGranular('employee', gp, 'subscriptions', 'freeze')).toBe(false)
      expect(canDoGranular('employee', gp, 'subscriptions', 'withdraw')).toBe(false)
    })

    it('falls back to role defaults when granularPermissions is undefined', () => {
      expect(canDoGranular('owner', undefined, 'subscribers', 'delete')).toBe(true)
      expect(canDoGranular('employee', undefined, 'subscribers', 'delete')).toBe(false)
    })
  })

  describe('granularToFlat', () => {
    it('converts owner granular permissions to flat correctly', () => {
      const flat = granularToFlat(DEFAULT_GRANULAR_PERMISSIONS.owner)
      expect(flat.canViewAll).toBe(true)
      expect(flat.canDelete).toBe(true)
      expect(flat.canManageUsers).toBe(true)
    })

    it('converts employee granular permissions to flat correctly', () => {
      const flat = granularToFlat(DEFAULT_GRANULAR_PERMISSIONS.employee)
      expect(flat.canViewAll).toBe(true)
      expect(flat.canDelete).toBe(false)
      expect(flat.canManageUsers).toBe(false)
    })
  })

  describe('isKnownRole', () => {
    it('accepts the three system roles', () => {
      expect(isKnownRole('owner')).toBe(true)
      expect(isKnownRole('admin')).toBe(true)
      expect(isKnownRole('employee')).toBe(true)
    })

    it('rejects anything else', () => {
      expect(isKnownRole('superadmin')).toBe(false)
      expect(isKnownRole('')).toBe(false)
      expect(isKnownRole(undefined)).toBe(false)
      expect(isKnownRole(null)).toBe(false)
      expect(isKnownRole(1)).toBe(false)
      expect(isKnownRole({})).toBe(false)
    })
  })

  describe('canManageRole', () => {
    it('lets an owner manage every role', () => {
      expect(canManageRole('owner', 'owner')).toBe(true)
      expect(canManageRole('owner', 'admin')).toBe(true)
      expect(canManageRole('owner', 'employee')).toBe(true)
    })

    it('lets an admin manage only employees', () => {
      expect(canManageRole('admin', 'employee')).toBe(true)
      expect(canManageRole('admin', 'admin')).toBe(false)
      expect(canManageRole('admin', 'owner')).toBe(false)
    })

    it('lets an employee manage nobody', () => {
      expect(canManageRole('employee', 'employee')).toBe(false)
      expect(canManageRole('employee', 'owner')).toBe(false)
    })
  })

  describe('canAssignRole', () => {
    it('lets an owner assign any known role', () => {
      expect(canAssignRole('owner', 'owner')).toBe(true)
      expect(canAssignRole('owner', 'admin')).toBe(true)
      expect(canAssignRole('owner', 'employee')).toBe(true)
    })

    it('lets an admin assign only the employee role', () => {
      expect(canAssignRole('admin', 'employee')).toBe(true)
      expect(canAssignRole('admin', 'admin')).toBe(false)
      expect(canAssignRole('admin', 'owner')).toBe(false)
    })

    it('lets an employee assign nothing', () => {
      expect(canAssignRole('employee', 'employee')).toBe(false)
    })

    // Regression: the owner branch used to return true unconditionally, so an
    // unrecognised role from a request body was written straight to the user
    // document — leaving that account matched by no rule in firestore.rules.
    it('refuses an unknown role even for an owner', () => {
      const unknownRoles = ['superadmin', 'root', 'Owner', 'OWNER', '', ' owner']
      for (const bad of unknownRoles) {
        expect(canAssignRole('owner', bad as Role)).toBe(false)
      }
      expect(canAssignRole('owner', undefined as unknown as Role)).toBe(false)
      expect(canAssignRole('owner', null as unknown as Role)).toBe(false)
      expect(canAssignRole('owner', {} as unknown as Role)).toBe(false)
    })
  })
})
