/**
 * The permission model has four lists, and they must be the same list.
 *
 *   GranularPermissions   the type
 *   ROLE_CEILING          the maximum per authority level
 *   PERMISSION_LABELS     what the editor renders as checkboxes
 *   granularPermissionsSchema  what survives a save
 *
 * They had drifted. `subscribers.assign / transfer / changeStatus / viewNotes /
 * addNotes` and `subscriptions.manageRenewals` existed in the type and in the
 * labels — so an owner could tick them — but not in the ceiling and not in the
 * save schema. effectivePermissions() iterates the ceiling, so it dropped them;
 * the schema stripped them on the way to Firestore. The checkbox saved nothing,
 * reported success, and the employee held no new capability. Six phantom
 * permissions, each of which read as a working feature.
 *
 * These tests make the four lists prove they agree, so the next permission
 * either exists everywhere or fails here.
 */
import {
  ROLE_CEILING,
  DEFAULT_GRANULAR_PERMISSIONS,
  EMPLOYEE_ROLE_PERMISSIONS,
  effectivePermissions,
  describePermissions,
} from '@/lib/permissions'
import { PERMISSION_LABELS, PERMISSION_DESCRIPTIONS } from '@/types/permissions'
import { granularPermissionsSchema } from '@/features/users/schemas'
import type { Role, EmployeeRole } from '@/types'

type PermMap = Record<string, Record<string, boolean>>

function pathsOf(map: Record<string, Record<string, unknown>>): string[] {
  return Object.entries(map)
    .flatMap(([cat, actions]) => Object.keys(actions).map((a) => `${cat}.${a}`))
    .sort()
}

const CEILING_PATHS = pathsOf(ROLE_CEILING.owner as unknown as PermMap)

/** The six that could be ticked but never granted. */
const PHANTOMS = [
  'subscribers.assign',
  'subscribers.transfer',
  'subscribers.changeStatus',
  'subscribers.viewNotes',
  'subscribers.addNotes',
  'subscriptions.manageRenewals',
]

describe('the four permission lists agree', () => {
  it('labels cover exactly the ceiling, no more and no less', () => {
    const labelPaths = pathsOf(
      Object.fromEntries(
        Object.entries(PERMISSION_LABELS).map(([cat, meta]) => [cat, meta.actions])
      )
    )
    expect(labelPaths).toEqual(CEILING_PATHS)
  })

  it('the save schema accepts exactly the ceiling', () => {
    const full = Object.fromEntries(
      Object.entries(ROLE_CEILING.owner as unknown as PermMap).map(([cat, actions]) => [
        cat,
        Object.fromEntries(Object.keys(actions).map((a) => [a, true])),
      ])
    )
    const parsed = granularPermissionsSchema.safeParse(full)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(pathsOf(parsed.data as unknown as PermMap)).toEqual(CEILING_PATHS)
    }
  })

  it('every ceiling action has a readable description', () => {
    for (const path of CEILING_PATHS) {
      expect(PERMISSION_DESCRIPTIONS[path]).toBeTruthy()
    }
  })

  it('every role default and job preset covers exactly the ceiling', () => {
    const tables: Record<string, PermMap> = {
      ...Object.fromEntries(
        (Object.keys(DEFAULT_GRANULAR_PERMISSIONS) as Role[]).map((r) => [
          `default:${r}`, DEFAULT_GRANULAR_PERMISSIONS[r] as unknown as PermMap,
        ])
      ),
      ...Object.fromEntries(
        (Object.keys(EMPLOYEE_ROLE_PERMISSIONS) as EmployeeRole[]).map((r) => [
          `preset:${r}`, EMPLOYEE_ROLE_PERMISSIONS[r] as unknown as PermMap,
        ])
      ),
    }
    for (const [name, table] of Object.entries(tables)) {
      expect([name, pathsOf(table)]).toEqual([name, CEILING_PATHS])
    }
  })
})

describe('the phantom permissions stay gone', () => {
  it.each(PHANTOMS)('%s is not part of the model', (path) => {
    expect(CEILING_PATHS).not.toContain(path)
    expect(PERMISSION_DESCRIPTIONS[path]).toBeUndefined()
  })

  it('a stored grant naming one of them confers nothing', () => {
    // Exactly what a pre-existing user document might still carry.
    const stale = {
      ...DEFAULT_GRANULAR_PERMISSIONS.employee,
      subscribers: {
        ...DEFAULT_GRANULAR_PERMISSIONS.employee.subscribers,
        transfer: true, changeStatus: true, viewNotes: true, addNotes: true, assign: true,
      },
      subscriptions: {
        ...DEFAULT_GRANULAR_PERMISSIONS.employee.subscriptions,
        manageRenewals: true,
      },
    } as unknown as typeof DEFAULT_GRANULAR_PERMISSIONS.employee

    const effective = effectivePermissions({
      role: 'employee', employeeRole: 'sales', granularPermissions: stale,
    }) as unknown as PermMap

    expect(pathsOf(effective)).toEqual(CEILING_PATHS)
    expect(effective.subscribers.transfer).toBeUndefined()
    expect(effective.subscriptions.manageRenewals).toBeUndefined()
  })

  it('the save schema strips them rather than persisting them', () => {
    const withPhantoms = {
      ...DEFAULT_GRANULAR_PERMISSIONS.employee,
      subscribers: { ...DEFAULT_GRANULAR_PERMISSIONS.employee.subscribers, transfer: true },
    }
    const parsed = granularPermissionsSchema.parse(withPhantoms)
    expect('transfer' in parsed.subscribers).toBe(false)
  })
})

describe('describePermissions', () => {
  it('reports the clamped answer, not the stored one', () => {
    // The employee ceiling withholds subscribers.delete whatever the grant says.
    const overreaching = {
      ...DEFAULT_GRANULAR_PERMISSIONS.employee,
      subscribers: { view: true, create: true, edit: true, delete: true },
    }
    const lines = describePermissions({
      role: 'employee', employeeRole: 'sales', granularPermissions: overreaching,
    })
    expect(lines).toContain(PERMISSION_DESCRIPTIONS['subscribers.edit'])
    expect(lines).not.toContain(PERMISSION_DESCRIPTIONS['subscribers.delete'])
  })

  it('returns nothing for an account granted nothing', () => {
    const none = Object.fromEntries(
      Object.entries(ROLE_CEILING.employee as unknown as PermMap).map(([cat, actions]) => [
        cat, Object.fromEntries(Object.keys(actions).map((a) => [a, false])),
      ])
    ) as unknown as typeof DEFAULT_GRANULAR_PERMISSIONS.employee

    expect(describePermissions({ role: 'employee', granularPermissions: none })).toEqual([])
  })
})
