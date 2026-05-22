import {
  getPermissions,
  hasPermission,
  canDoGranular,
  DEFAULT_GRANULAR_PERMISSIONS,
  granularToFlat,
} from '@/lib/permissions'
import type { GranularPermissions } from '@/types'

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
})
