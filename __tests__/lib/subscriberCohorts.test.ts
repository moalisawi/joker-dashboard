import {
  cohortOf,
  summarizeCohorts,
  byNewestFirst,
  COHORTS,
  EXPIRING_WINDOW_DAYS,
  type CohortSubscriber,
} from '@/lib/subscriberCohorts'

/*
 * Cohorts must partition the book.
 *
 * That is the property the whole feature rests on: if the counts do not sum to
 * the total, the owner cannot reconcile them, and numbers that cannot be
 * reconciled do not get acted on. The boundary days and the priority cascade
 * are where a partition quietly breaks, so both are pinned here.
 */

const s = (over: Partial<CohortSubscriber> = {}): CohortSubscriber => ({
  subscriptionState: 'active', daysRemaining: 90, ...over,
})

describe('cohortOf', () => {
  describe('the priority cascade — order is a business statement', () => {
    it('withdrawal beats everything: they left', () => {
      expect(cohortOf(s({ subscriptionState: 'withdrawn', daysRemaining: -200 }))).toBe('withdrawn')
      expect(cohortOf(s({ subscriptionState: 'withdrawn', subscriptionStatus: 'paused' }))).toBe('withdrawn')
    })

    it('a hold beats expiry: the clock is paused, they have not lapsed', () => {
      expect(cohortOf(s({ subscriptionStatus: 'paused', daysRemaining: -60 }))).toBe('on_hold')
      expect(cohortOf(s({ freezeData: { isFrozen: true }, daysRemaining: -60 }))).toBe('on_hold')
      expect(cohortOf(s({ subscriptionStatus: 'frozen' }))).toBe('on_hold')
    })
  })

  describe('boundaries — the day either side of every cut', () => {
    it('splits active from expiring at the window edge', () => {
      expect(cohortOf(s({ daysRemaining: EXPIRING_WINDOW_DAYS }))).toBe('expiring')
      expect(cohortOf(s({ daysRemaining: EXPIRING_WINDOW_DAYS + 1 }))).toBe('active')
    })

    it('the last day of the term is expiring, not lapsed', () => {
      expect(cohortOf(s({ daysRemaining: 0 }))).toBe('expiring')
    })

    it('the first day past expiry is lapsed', () => {
      expect(cohortOf(s({ daysRemaining: -1 }))).toBe('lapsed_7')
    })

    it('walks the lapsed ladder at 7, 30 and 90 days', () => {
      expect(cohortOf(s({ daysRemaining: -7 }))).toBe('lapsed_7')
      expect(cohortOf(s({ daysRemaining: -8 }))).toBe('lapsed_30')
      expect(cohortOf(s({ daysRemaining: -30 }))).toBe('lapsed_30')
      expect(cohortOf(s({ daysRemaining: -31 }))).toBe('lapsed_90')
      expect(cohortOf(s({ daysRemaining: -90 }))).toBe('lapsed_90')
      expect(cohortOf(s({ daysRemaining: -91 }))).toBe('lapsed_old')
    })
  })

  it('treats a record with no daysRemaining as expiring rather than guessing', () => {
    // 0 is the safe reading: it surfaces the record for a human instead of
    // filing it silently among the long-lapsed where nobody would look.
    expect(cohortOf({ subscriptionState: 'active' })).toBe('expiring')
  })
})

describe('summarizeCohorts', () => {
  const book: CohortSubscriber[] = [
    s({ daysRemaining: 200, netAmountUSD: 300, remainingAmountUSD: 0 }),
    s({ daysRemaining: 3, netAmountUSD: 200, remainingAmountUSD: 50 }),
    s({ daysRemaining: -2, netAmountUSD: 150 }),
    s({ daysRemaining: -20, netAmountUSD: 100 }),
    s({ daysRemaining: -60, netAmountUSD: 100 }),
    s({ daysRemaining: -300, netAmountUSD: 100 }),
    s({ subscriptionStatus: 'paused', netAmountUSD: 80, remainingAmountUSD: 30 }),
    s({ subscriptionState: 'withdrawn', netAmountUSD: 70 }),
  ]

  it('THE INVARIANT: every subscriber lands in exactly one cohort', () => {
    const total = summarizeCohorts(book).reduce((n, c) => n + c.count, 0)
    expect(total).toBe(book.length)
  })

  it('holds the invariant for an awkward book too', () => {
    const odd = [
      s({ daysRemaining: 0 }), s({ daysRemaining: -1 }), s({ daysRemaining: -91 }),
      s({ subscriptionState: 'withdrawn', subscriptionStatus: 'paused', daysRemaining: -5 }),
      {} as CohortSubscriber,
    ]
    expect(summarizeCohorts(odd).reduce((n, c) => n + c.count, 0)).toBe(odd.length)
  })

  it('adds up the money at stake per group', () => {
    const by = Object.fromEntries(summarizeCohorts(book).map((c) => [c.id, c]))
    expect(by.active.valueUSD).toBe(300)
    expect(by.expiring.valueUSD).toBe(200)
    expect(by.lapsed_7.valueUSD).toBe(150)
    expect(by.on_hold.outstandingUSD).toBe(30)
    expect(by.expiring.outstandingUSD).toBe(50)
  })

  it('returns every cohort even when empty, so the strip never reshuffles', () => {
    const all = summarizeCohorts([])
    expect(all).toHaveLength(COHORTS.length)
    expect(all.every((c) => c.count === 0)).toBe(true)
  })

  it('keeps the cohorts in their declared order', () => {
    expect(summarizeCohorts(book).map((c) => c.id)).toEqual(COHORTS.map((c) => c.id))
  })
})

describe('byNewestFirst', () => {
  it('puts the most recent sign-up first', () => {
    const rows = [{ date: '2026-01-01' }, { date: '2026-08-30' }, { date: '2026-05-15' }]
    expect(byNewestFirst(rows).map((r) => r.date)).toEqual(['2026-08-30', '2026-05-15', '2026-01-01'])
  })

  it('does not mutate the input', () => {
    const rows = [{ date: '2026-01-01' }, { date: '2026-08-30' }]
    byNewestFirst(rows)
    expect(rows[0].date).toBe('2026-01-01')
  })

  it('sinks records with no date rather than dropping them', () => {
    const rows = [{ date: undefined }, { date: '2026-01-01' }]
    expect(byNewestFirst(rows).map((r) => r.date)).toEqual(['2026-01-01', undefined])
  })
})
