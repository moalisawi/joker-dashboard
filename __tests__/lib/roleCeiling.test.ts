/**
 * The role ceiling.
 *
 * Before this existed the system carried two independent "role" dimensions with
 * separate permission tables and no rule about which won: `role` (owner/admin/
 * employee) and `employeeRole` (sales/followup/team_leader). The tables
 * disagreed, and which one applied depended on whether the user's Firestore
 * document happened to carry a `granularPermissions` field.
 *
 * The consequence was not theoretical. `sales` — the default job for every
 * employee created through the UI — granted delete, refund and withdraw, none
 * of which an admin had. A standard new hire outranked a manager.
 *
 * These tests exist to keep that from coming back. The property they protect is
 * simple: no grant, from any source, can exceed the ceiling for the account's
 * authority level.
 */
import {
  DEFAULT_GRANULAR_PERMISSIONS,
  EMPLOYEE_ROLE_PERMISSIONS,
  ROLE_CEILING,
  effectivePermissions,
  intersectPermissions,
} from '@/lib/permissions'
import type { GranularPermissions, Role, EmployeeRole } from '@/types'

type PermMap = Record<string, Record<string, boolean>>

/** Every "category.action" the model defines. */
function allActions(): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const owner = ROLE_CEILING.owner as unknown as PermMap
  for (const category of Object.keys(owner)) {
    for (const action of Object.keys(owner[category])) pairs.push([category, action])
  }
  return pairs
}

function granted(gp: GranularPermissions, category: string, action: string): boolean {
  return (gp as unknown as PermMap)[category]?.[action] === true
}

/** A grant asking for everything — the strongest possible input. */
const EVERYTHING = ROLE_CEILING.owner

describe('ROLE_CEILING', () => {
  it('lets the owner do everything', () => {
    for (const [category, action] of allActions()) {
      expect(granted(ROLE_CEILING.owner, category, action)).toBe(true)
    }
  })

  it('withholds the three irreversible money actions from employees', () => {
    expect(granted(ROLE_CEILING.employee, 'subscribers', 'delete')).toBe(false)
    expect(granted(ROLE_CEILING.employee, 'payments', 'refund')).toBe(false)
    expect(granted(ROLE_CEILING.employee, 'subscriptions', 'withdraw')).toBe(false)
  })

  it('keeps user management with the owner', () => {
    expect(granted(ROLE_CEILING.admin, 'users', 'manage')).toBe(false)
    expect(granted(ROLE_CEILING.admin, 'users', 'changeRoles')).toBe(false)
    // Suspending an existing account is supervision, not granting authority.
    expect(granted(ROLE_CEILING.admin, 'users', 'activateAccounts')).toBe(true)
  })

  it('gives the admin full operational authority', () => {
    for (const [category, action] of allActions()) {
      if (category === 'users' && action !== 'activateAccounts') continue
      expect(granted(ROLE_CEILING.admin, category, action)).toBe(true)
    }
  })

  it('never lets a lower authority exceed a higher one', () => {
    // The property the whole design rests on: reading down the hierarchy, a
    // permission can be withdrawn but never added.
    for (const [category, action] of allActions()) {
      const owner    = granted(ROLE_CEILING.owner, category, action)
      const admin    = granted(ROLE_CEILING.admin, category, action)
      const employee = granted(ROLE_CEILING.employee, category, action)

      if (!owner) expect(admin).toBe(false)
      if (!admin) expect(employee).toBe(false)
    }
  })
})

describe('intersectPermissions', () => {
  it('requires both sides to allow an action', () => {
    const result = intersectPermissions(ROLE_CEILING.employee, EVERYTHING)
    expect(granted(result, 'subscribers', 'delete')).toBe(false)
    expect(granted(result, 'subscribers', 'edit')).toBe(true)
  })

  it('does not turn on what the grant leaves off', () => {
    const nothing = intersectPermissions(
      ROLE_CEILING.owner,
      DEFAULT_GRANULAR_PERMISSIONS.employee
    )
    expect(granted(nothing, 'users', 'manage')).toBe(false)
  })

  it('covers every action the ceiling defines, even absent from the grant', () => {
    const sparse = { subscribers: { view: true } } as unknown as GranularPermissions
    const result = intersectPermissions(ROLE_CEILING.owner, sparse)
    for (const [category, action] of allActions()) {
      expect(typeof granted(result, category, action)).toBe('boolean')
    }
    expect(granted(result, 'payments', 'refund')).toBe(false)
  })
})

describe('effectivePermissions', () => {
  it('clamps a job preset that asks for more than the role allows', () => {
    // The original bug, stated directly.
    const salesperson = effectivePermissions({ role: 'employee', employeeRole: 'sales' })
    expect(granted(salesperson, 'subscribers', 'delete')).toBe(false)
    expect(granted(salesperson, 'payments', 'refund')).toBe(false)
    expect(granted(salesperson, 'subscriptions', 'withdraw')).toBe(false)
  })

  it('clamps a per-user override that asks for everything', () => {
    const overreaching = effectivePermissions({
      role: 'employee',
      granularPermissions: EVERYTHING,
    })
    expect(granted(overreaching, 'users', 'manage')).toBe(false)
    expect(granted(overreaching, 'subscribers', 'delete')).toBe(false)
  })

  it('never lets an employee out-permission an admin', () => {
    const admin = effectivePermissions({ role: 'admin' })
    const jobs: EmployeeRole[] = ['sales', 'followup', 'team_leader']

    for (const job of jobs) {
      const staff = effectivePermissions({ role: 'employee', employeeRole: job })
      for (const [category, action] of allActions()) {
        if (granted(staff, category, action)) {
          expect(granted(admin, category, action)).toBe(true)
        }
      }
    }
  })

  it('prefers an explicit override to the job preset', () => {
    const restricted = {
      ...DEFAULT_GRANULAR_PERMISSIONS.employee,
      subscribers: { view: true, create: false, edit: false, delete: false },
    } as GranularPermissions

    const user = effectivePermissions({
      role: 'employee',
      employeeRole: 'sales', // preset would allow create
      granularPermissions: restricted,
    })
    expect(granted(user, 'subscribers', 'create')).toBe(false)
  })

  it('falls back to role defaults for accounts with neither job nor override', () => {
    // Accounts predating the granular system carry only a role.
    const legacy = effectivePermissions({ role: 'admin' })
    expect(granted(legacy, 'subscribers', 'view')).toBe(true)
    expect(granted(legacy, 'users', 'manage')).toBe(false)
  })

  it('treats an unknown role as the least privileged', () => {
    const rogue = effectivePermissions({ role: 'superadmin' as Role })
    for (const [category, action] of allActions()) {
      if (granted(rogue, category, action)) {
        expect(granted(ROLE_CEILING.employee, category, action)).toBe(true)
      }
    }
    expect(granted(rogue, 'users', 'manage')).toBe(false)
  })
})

describe('job presets state what they actually confer', () => {
  // A preset that silently loses half its entries to the ceiling is misleading
  // to whoever reads the table to understand what a job can do.
  const jobs: EmployeeRole[] = ['sales', 'followup', 'team_leader']

  it.each(jobs)('%s asks for nothing the employee ceiling refuses', (job) => {
    const preset = EMPLOYEE_ROLE_PERMISSIONS[job]
    for (const [category, action] of allActions()) {
      if (granted(preset, category, action)) {
        expect(granted(ROLE_CEILING.employee, category, action)).toBe(true)
      }
    }
  })
})
