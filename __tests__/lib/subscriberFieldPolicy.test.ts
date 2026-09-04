import {
  CREATE_ONLY_FIELDS,
  CREATE_WRITABLE_SUBSCRIBER_FIELDS,
  SUBSCRIBER_FIELD_POLICY,
} from '@/constants/subscriberFieldPolicy'
import { SUBSCRIBER_SCHEMA_FIELDS } from '@/lib/subscriberWriteSchema'
import { normalizeSubscriber } from '@/lib/utils'

/**
 * The bug these tests exist for.
 *
 * The signup form collected `residence`, `phoneCountry`, `dialCode`, `referrer`
 * and `sourceDetail`. The Zod schema listed all five and validated them. An
 * allow-list twelve lines further down the same file did not, and filtered them
 * out before the write. Nothing threw, nothing logged, and the field was gone.
 *
 * The whole test suite was green throughout. It could not have been otherwise:
 * no test compared the two lists, because there was nothing that held both.
 *
 * So these are not tests of a fix, they are tests of an agreement. Three layers
 * have to say the same thing about every field — what the server accepts, what
 * the server stores, and what the reader gets back — and each test below pins
 * one join between two of them.
 */
describe('subscriber field policy', () => {
  it('classifies every field the write schema accepts', () => {
    // A field the schema validates and the policy has never heard of is exactly
    // the old failure: accepted at the door, dropped in the hallway.
    const unclassified = SUBSCRIBER_SCHEMA_FIELDS.filter(
      (field) => !(field in SUBSCRIBER_FIELD_POLICY)
    )
    expect(unclassified).toEqual([])
  })

  it('accepts every field it says a client may write', () => {
    // The mirror of the test above. A field marked client-writable that the
    // schema strips is just as invisible — Zod removes unknown keys silently.
    const accepted = new Set(SUBSCRIBER_SCHEMA_FIELDS)
    const unreachable = [...CREATE_WRITABLE_SUBSCRIBER_FIELDS].filter(
      (field) => !accepted.has(field)
    )
    expect(unreachable).toEqual([])
  })

  it('keeps server-owned fields out of the client-writable set', () => {
    const leaked = Object.entries(SUBSCRIBER_FIELD_POLICY)
      .filter(([, policy]) => policy === 'server' || policy === 'derived')
      .map(([field]) => field)
      .filter((field) => CREATE_WRITABLE_SUBSCRIBER_FIELDS.has(field))
    expect(leaked).toEqual([])
  })

  it('never lets a client write a balance or a lifecycle flag', () => {
    // Named explicitly rather than left to the loop above: these are the fields
    // where a silent reclassification would move money or resurrect a withdrawal.
    const mustNeverBeClientWritable = [
      'paidAmountUSD',
      'remainingAmountUSD',
      'netAmountUSD',
      'lifetimeValueUSD',
      'renewalCount',
      'renewals',
      'subscriptionState',
      'subscriptionStatus',
      'withdrawalData',
      'freezeData',
      'deleted',
      'createdBy',
      'currentCycleId',
      'currentInvoiceId',
    ]
    for (const field of mustNeverBeClientWritable) {
      expect(CREATE_WRITABLE_SUBSCRIBER_FIELDS.has(field)).toBe(false)
    }
  })

  it('holds the terms of the sale to exactly the traced list', () => {
    // Every `create_only` field was put there because a writer of it was traced
    // in the code. A tenth appearing without that trace is a failing test rather
    // than a discovery six months on.
    const flagged = Object.entries(SUBSCRIBER_FIELD_POLICY)
      .filter(([, policy]) => policy === 'create_only')
      .map(([field]) => field)
      .sort()
    expect(flagged).toEqual([...CREATE_ONLY_FIELDS].sort())
  })

  it('reads back every field a client is allowed to write', () => {
    /*
     * The third layer. A field can be accepted and stored and still never reach
     * a screen if the normaliser does not copy it — which is what happened to
     * the extended profile: `gender`, `height`, `weight` and `goal` were written
     * on every signup and dropped on the way back, so no screen could show them.
     *
     * Giving every writable field a value and asserting none comes back
     * undefined catches that without naming the fields twice.
     */
    const raw: Record<string, unknown> = { id: 'test-1' }
    const sample: Record<string, unknown> = {
      duration: 30,
      age: 30,
      height: 175,
      weight: 80,
      lockedRate: 3.65,
      totalPrice: 100,
      totalPriceUSD: 100,
      gender: 'male',
    }
    for (const field of CREATE_WRITABLE_SUBSCRIBER_FIELDS) {
      raw[field] = sample[field] ?? `v-${field}`
    }

    const normalized = normalizeSubscriber(
      raw as Record<string, unknown> & { id: string }
    ) as unknown as Record<string, unknown>

    const dropped = [...CREATE_WRITABLE_SUBSCRIBER_FIELDS].filter(
      (field) => normalized[field] === undefined
    )
    expect(dropped).toEqual([])
  })
})
