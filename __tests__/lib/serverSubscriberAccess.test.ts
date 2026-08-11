/**
 * Row-level authorization for subscriber mutations.
 *
 * firestore.rules scopes what an employee may *read*. It has nothing to say
 * about the API routes, because every write there goes through the Admin SDK,
 * which bypasses rules by design. Those routes asked only "may this person edit
 * subscribers?" — never "may they edit *this* subscriber?" — so an employee
 * holding the capability could post any subscriber id and mutate a colleague's
 * record. The id was the only thing they needed, and the UI hands out ids.
 *
 * These tests pin the rule that closes it. The ownership test mirrors
 * canReadSubscriberAsEmployee() in firestore.rules; if one gains a link field
 * and the other does not, a test here should start failing.
 */
import {
  canAssignSubscriberTo,
  canMutateSubscriber,
  isLinkedToSubscriber,
  assertCanAccessSubscriber,
  type SubscriberAccessActor,
  type SubscriberAction,
  type SubscriberLinkFields,
} from '@/lib/serverSubscriberAccess'

const EMP = 'uid-employee-1'
const OTHER = 'uid-employee-2'

function employee(overrides: Partial<SubscriberAccessActor> = {}): SubscriberAccessActor {
  return { uid: EMP, role: 'employee', ...overrides }
}

const ALL_ACTIONS: SubscriberAction[] = [
  'view', 'edit', 'delete', 'payment', 'renew',
  'withdraw', 'pause', 'freeze', 'resume', 'changeStatus', 'assign',
]

describe('isLinkedToSubscriber', () => {
  it('links via convincedByUid', () => {
    expect(isLinkedToSubscriber(employee(), { convincedByUid: EMP })).toBe(true)
  })

  it('links via assignedSalesId', () => {
    expect(isLinkedToSubscriber(employee(), { assignedSalesId: EMP })).toBe(true)
  })

  it('links via assignedNutritionistId', () => {
    expect(isLinkedToSubscriber(employee(), { assignedNutritionistId: EMP })).toBe(true)
  })

  it('does not link a subscriber belonging to someone else', () => {
    expect(isLinkedToSubscriber(employee(), { convincedByUid: OTHER })).toBe(false)
  })

  it('does not link an unowned subscriber', () => {
    // An orphan record is not "everyone's" — it is a supervisor's problem.
    expect(isLinkedToSubscriber(employee(), {})).toBe(false)
    expect(isLinkedToSubscriber(employee(), null)).toBe(false)
  })

  describe('legacy name fallback', () => {
    it('links by employeeName when the record predates convincedByUid', () => {
      expect(
        isLinkedToSubscriber(employee({ employeeName: 'ميدو' }), { convincedBy: 'ميدو' })
      ).toBe(true)
    })

    it('ignores the name once a uid is recorded', () => {
      // Two employees share the display name ميدو (see the hardening write-up).
      // If the name still counted after a uid exists, each would reach the
      // other's subscribers — the exact collision the uid migration fixed.
      expect(
        isLinkedToSubscriber(
          employee({ employeeName: 'ميدو' }),
          { convincedBy: 'ميدو', convincedByUid: OTHER }
        )
      ).toBe(false)
    })

    it('does not link on an empty name', () => {
      expect(isLinkedToSubscriber(employee({ employeeName: '' }), { convincedBy: '' })).toBe(false)
      expect(isLinkedToSubscriber(employee(), { convincedBy: '' })).toBe(false)
    })
  })

  it('ignores non-string link fields', () => {
    // Firestore holds whatever was written; a number or object must not match.
    expect(isLinkedToSubscriber(employee(), { convincedByUid: 12345 })).toBe(false)
    expect(isLinkedToSubscriber(employee(), { convincedByUid: { uid: EMP } })).toBe(false)
  })

  it('tolerates surrounding whitespace on either side', () => {
    expect(isLinkedToSubscriber(employee(), { convincedByUid: `  ${EMP}  ` })).toBe(true)
  })
})

describe('canMutateSubscriber', () => {
  it.each(ALL_ACTIONS)('lets an owner %s any subscriber', (action) => {
    const actor: SubscriberAccessActor = { uid: 'uid-owner', role: 'owner' }
    expect(canMutateSubscriber(actor, { convincedByUid: OTHER }, action).allowed).toBe(true)
  })

  it.each(ALL_ACTIONS)('lets an admin %s any subscriber', (action) => {
    const actor: SubscriberAccessActor = { uid: 'uid-admin', role: 'admin' }
    expect(canMutateSubscriber(actor, { convincedByUid: OTHER }, action).allowed).toBe(true)
  })

  it.each(ALL_ACTIONS)('refuses an employee %s on a colleague\'s subscriber', (action) => {
    const decision = canMutateSubscriber(employee(), { convincedByUid: OTHER }, action)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBeTruthy()
  })

  it.each(ALL_ACTIONS)('allows an employee %s on their own subscriber', (action) => {
    expect(canMutateSubscriber(employee(), { convincedByUid: EMP }, action).allowed).toBe(true)
  })

  it('refuses when the subscriber is missing', () => {
    const decision = canMutateSubscriber(employee(), null, 'edit')
    expect(decision.allowed).toBe(false)
  })

  it('does not leak the owner in the refusal message', () => {
    const decision = canMutateSubscriber(employee(), { convincedByUid: OTHER }, 'edit')
    expect(decision.reason).not.toContain(OTHER)
  })
})

describe('assertCanAccessSubscriber', () => {
  it('is silent when allowed', () => {
    expect(() =>
      assertCanAccessSubscriber(employee(), { convincedByUid: EMP }, 'payment')
    ).not.toThrow()
  })

  it('throws with status 403 so the route answers Forbidden, not 500', () => {
    try {
      assertCanAccessSubscriber(employee(), { convincedByUid: OTHER }, 'payment')
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as { status?: number }).status).toBe(403)
    }
  })
})

describe('canAssignSubscriberTo', () => {
  const own: SubscriberLinkFields = { convincedByUid: EMP }

  it('lets an employee claim a subscriber they already own', () => {
    expect(canAssignSubscriberTo(employee(), own, [EMP]).allowed).toBe(true)
  })

  it('lets an employee unassign — empty and null targets', () => {
    expect(canAssignSubscriberTo(employee(), own, [null, undefined, '']).allowed).toBe(true)
  })

  it('refuses handing a subscriber to a colleague', () => {
    // Otherwise an employee could launder records between staff.
    const decision = canAssignSubscriberTo(employee(), own, [OTHER])
    expect(decision.allowed).toBe(false)
  })

  it('refuses taking a subscriber that is not theirs', () => {
    // The escalation this module exists to stop: reassigning someone else's
    // subscriber to yourself.
    const decision = canAssignSubscriberTo(employee(), { convincedByUid: OTHER }, [EMP])
    expect(decision.allowed).toBe(false)
  })

  it('refuses a mixed payload that smuggles a foreign uid alongside their own', () => {
    const decision = canAssignSubscriberTo(employee(), own, [EMP, OTHER])
    expect(decision.allowed).toBe(false)
  })

  it('lets an owner move a subscriber between any two people', () => {
    const actor: SubscriberAccessActor = { uid: 'uid-owner', role: 'owner' }
    expect(canAssignSubscriberTo(actor, { convincedByUid: OTHER }, [EMP]).allowed).toBe(true)
  })
})
