import {
  recognizedInPeriod,
  recognizedToDate,
  deferredAsOf,
  summarizeRevenue,
  serviceSpan,
} from '@/lib/revenueRecognition'

/*
 * Straight-line revenue recognition.
 *
 * These are the numbers an owner would take to a bank or an investor, so the
 * failure mode is not a crash — it is a plausible wrong figure that nobody can
 * reconcile months later. The boundary cases carry the risk: the first and last
 * day of a term, a term that straddles two months, and a record too incomplete
 * to recognise at all.
 */

// $300 over 90 days = $3.3333… a day. Deliberately not a round rate.
const plan = { date: '2026-01-01', duration: 90, totalPriceUSD: 300, paidAmountUSD: 300 }

describe('serviceSpan', () => {
  it('refuses a record with no duration rather than dividing by zero', () => {
    expect(serviceSpan({ date: '2026-01-01', duration: 0, totalPriceUSD: 300 })).toBeNull()
  })

  it('refuses a record with no start date', () => {
    expect(serviceSpan({ duration: 30, totalPriceUSD: 300 })).toBeNull()
  })

  it('accepts startDate when it differs from the record date', () => {
    expect(serviceSpan({ date: '2026-01-01', startDate: '2026-02-01', duration: 30 })?.days).toBe(30)
  })
})

describe('recognizedInPeriod', () => {
  it('earns nothing before the term starts', () => {
    expect(recognizedInPeriod(plan, '2025-12-01', '2025-12-31')).toBe(0)
  })

  it('earns nothing after the term ends', () => {
    expect(recognizedInPeriod(plan, '2026-06-01', '2026-06-30')).toBe(0)
  })

  it('earns exactly one day on the first day', () => {
    expect(recognizedInPeriod(plan, '2026-01-01', '2026-01-01')).toBeCloseTo(300 / 90, 6)
  })

  it('earns the whole price across the whole term', () => {
    expect(recognizedInPeriod(plan, '2026-01-01', '2026-03-31')).toBeCloseTo(300, 6)
  })

  it('splits a term that straddles two months, and the halves sum to the whole', () => {
    const jan = recognizedInPeriod(plan, '2026-01-01', '2026-01-31')
    const rest = recognizedInPeriod(plan, '2026-02-01', '2026-03-31')
    expect(jan).toBeCloseTo(31 * (300 / 90), 6)
    expect(jan + rest).toBeCloseTo(300, 6)
  })

  it('returns 0 for a reversed period instead of a negative figure', () => {
    expect(recognizedInPeriod(plan, '2026-03-01', '2026-01-01')).toBe(0)
  })
})

describe('deferred revenue', () => {
  it('is the entire payment on day one — nothing has been delivered yet', () => {
    // Recognised on the first day is one day's worth, so deferred is the rest.
    expect(deferredAsOf(plan, '2026-01-01')).toBeCloseTo(300 - 300 / 90, 6)
  })

  it('is zero once the term is fully served', () => {
    expect(deferredAsOf(plan, '2026-04-30')).toBe(0)
  })

  it('never goes negative when a subscriber has paid less than they consumed', () => {
    const halfPaid = { ...plan, paidAmountUSD: 50 }
    // Half the term consumed is $150 earned against $50 paid. That gap is a
    // receivable, which the outstanding figure already reports — not negative
    // deferred revenue.
    expect(deferredAsOf(halfPaid, '2026-02-15')).toBe(0)
  })

  it('recognised-to-date plus deferred equals what was paid, mid-term', () => {
    const asOf = '2026-02-01'
    expect(recognizedToDate(plan, asOf) + deferredAsOf(plan, asOf)).toBeCloseTo(300, 6)
  })
})

describe('summarizeRevenue', () => {
  it('adds up across subscribers', () => {
    const r = summarizeRevenue([plan, plan], '2026-01-01', '2026-01-31', '2026-01-31')
    expect(r.recognizedUSD).toBeCloseTo(2 * 31 * (300 / 90), 6)
  })

  it('counts unrecognisable records instead of silently dropping them', () => {
    const r = summarizeRevenue(
      [plan, { totalPriceUSD: 500, paidAmountUSD: 500 }],
      '2026-01-01', '2026-01-31', '2026-01-31',
    )
    expect(r.unrecognizable).toBe(1)
    // The broken record contributes nothing rather than a guess.
    expect(r.recognizedUSD).toBeCloseTo(31 * (300 / 90), 6)
  })

  it('reports zeros for an empty book', () => {
    expect(summarizeRevenue([], '2026-01-01', '2026-01-31', '2026-01-31'))
      .toEqual({ recognizedUSD: 0, deferredUSD: 0, unrecognizable: 0 })
  })

  it('separates cash from revenue in the case that motivated this', () => {
    // Paid $300 up front on 1 Jan for 90 days. January cash = $300, but only
    // 31 days were earned — about $103. Reporting $300 as January revenue is
    // the distortion this module exists to remove.
    const r = summarizeRevenue([plan], '2026-01-01', '2026-01-31', '2026-01-31')
    expect(r.recognizedUSD).toBeCloseTo(103.33, 1)
    expect(r.deferredUSD).toBeCloseTo(196.67, 1)
  })
})
