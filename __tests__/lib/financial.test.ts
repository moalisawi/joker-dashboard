/**
 * Unit tests for the money and subscription-lifecycle helpers.
 *
 * These functions decide what a subscriber owes, what counts as revenue, and
 * when a subscription is treated as expired. They had no unit coverage at all,
 * which is the wrong place for a financial system to be untested: a wrong
 * conversion or an off-by-one on expiry does not crash anything, it just
 * quietly produces wrong numbers.
 */
import { toUSD, formatCurrency, DEFAULT_RATES } from '@/lib/currency'
import {
  calculateExpiry,
  getDaysRemaining,
  getComputedStatus,
  isPaused,
  daysSince,
  calculateNetAmountUSD,
  getSubscriberFinancialSummary,
} from '@/lib/utils'
import type { Subscriber, ExchangeRates } from '@/types'

/** Minimal subscriber stub — only the fields the helpers under test read. */
function subscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'sub-1',
    totalPriceUSD: 0,
    paidAmountUSD: 0,
    subscriptionState: 'active',
    ...overrides,
  } as Subscriber
}

/** Fixed "today" so date assertions do not drift with the clock. */
function freezeToday(iso: string) {
  jest.useFakeTimers().setSystemTime(new Date(iso))
}

describe('currency', () => {
  describe('toUSD', () => {
    it('returns the amount unchanged for USD', () => {
      expect(toUSD(150, 'USD', DEFAULT_RATES)).toBe(150)
    })

    it('divides by the rate for other currencies', () => {
      expect(toUSD(4750, 'EGP', DEFAULT_RATES)).toBeCloseTo(100, 6)
      expect(toUSD(71, 'JOD', DEFAULT_RATES)).toBeCloseTo(100, 6)
      expect(toUSD(365, 'ILS', DEFAULT_RATES)).toBeCloseTo(100, 6)
    })

    it('uses the supplied rates, not the defaults — this is what locks a past rate in place', () => {
      const lockedRate: ExchangeRates = { ...DEFAULT_RATES, EGP: 30 }
      expect(toUSD(3000, 'EGP', lockedRate)).toBe(100)
      // Same amount at today's rate would be worth noticeably less.
      expect(toUSD(3000, 'EGP', DEFAULT_RATES)).toBeCloseTo(63.16, 2)
    })

    it('falls back to 1:1 when a rate is zero or missing, rather than dividing by zero', () => {
      expect(toUSD(80, 'EGP', { ...DEFAULT_RATES, EGP: 0 })).toBe(80)
      expect(Number.isFinite(toUSD(80, 'EGP', {} as ExchangeRates))).toBe(true)
    })

    it('handles zero and negative amounts (refunds are negative movements)', () => {
      expect(toUSD(0, 'EGP', DEFAULT_RATES)).toBe(0)
      expect(toUSD(-4750, 'EGP', DEFAULT_RATES)).toBeCloseTo(-100, 6)
    })
  })

  describe('formatCurrency', () => {
    it('always shows two decimals with the Arabic currency name', () => {
      expect(formatCurrency(150, 'USD')).toBe('150.00 دولار')
      expect(formatCurrency(99.5, 'EGP')).toBe('99.50 جنيه')
      expect(formatCurrency(0, 'JOD')).toBe('0.00 دينار')
    })

    it('rounds to two decimals', () => {
      expect(formatCurrency(10.005, 'USD')).toBe('10.01 دولار')
      expect(formatCurrency(10.004, 'USD')).toBe('10.00 دولار')
    })
  })
})

describe('subscription lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('calculateExpiry', () => {
    it('adds the given number of days to the start date', () => {
      expect(calculateExpiry('2026-01-01', 30)).toBe('2026-01-31')
      expect(calculateExpiry('2026-01-01', 0)).toBe('2026-01-01')
    })

    it('rolls over month and year boundaries', () => {
      expect(calculateExpiry('2026-12-20', 30)).toBe('2027-01-19')
    })

    it('accounts for leap years', () => {
      expect(calculateExpiry('2028-02-28', 1)).toBe('2028-02-29')
      expect(calculateExpiry('2026-02-28', 1)).toBe('2026-03-01')
    })

    it('treats a missing duration as zero instead of producing NaN', () => {
      expect(calculateExpiry('2026-01-01', undefined as unknown as number)).toBe('2026-01-01')
    })
  })

  describe('getDaysRemaining', () => {
    /** Local calendar date `offset` days from now, as YYYY-MM-DD. */
    function localDate(offset: number): string {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + offset)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // Regression: the countdown used to be built from a UTC-parsed date compared
    // against local midnight, so every one of these was off by one in UTC+
    // timezones — and correct in CI, which runs UTC. Asserting on local calendar
    // dates makes the test mean the same thing everywhere.
    it('returns 0 on the expiry day itself, in any timezone', () => {
      expect(getDaysRemaining(localDate(0))).toBe(0)
    })

    it('counts whole days forward', () => {
      expect(getDaysRemaining(localDate(1))).toBe(1)
      expect(getDaysRemaining(localDate(7))).toBe(7)
      expect(getDaysRemaining(localDate(30))).toBe(30)
    })

    it('goes negative once expired', () => {
      expect(getDaysRemaining(localDate(-1))).toBe(-1)
      expect(getDaysRemaining(localDate(-31))).toBe(-31)
    })

    it('advances by exactly one per calendar day', () => {
      for (let i = 0; i < 10; i++) {
        expect(getDaysRemaining(localDate(i + 1)) - getDaysRemaining(localDate(i))).toBe(1)
      }
    })

    it('ignores the time of day — a subscription does not expire at noon', () => {
      freezeToday('2026-06-10T23:59:00Z')
      const before = getDaysRemaining(localDate(0))
      jest.setSystemTime(new Date('2026-06-10T00:01:00Z'))
      expect(getDaysRemaining(localDate(0))).toBe(before)
    })
  })

  describe('getComputedStatus', () => {
    it('reports withdrawn regardless of anything else', () => {
      expect(getComputedStatus({
        subscriptionState: 'withdrawn',
        subscriptionStatus: 'frozen',
        daysRemaining: 100,
      })).toBe('منسحب')
    })

    it('ranks frozen above paused', () => {
      expect(getComputedStatus({
        subscriptionState: 'active', subscriptionStatus: 'frozen', daysRemaining: 5,
      })).toBe('متجمد')
      expect(getComputedStatus({
        subscriptionState: 'active', subscriptionStatus: 'paused', daysRemaining: 5,
      })).toBe('موقوف')
    })

    it('marks a frozen subscription as frozen even after its date has passed', () => {
      expect(getComputedStatus({
        subscriptionState: 'active', subscriptionStatus: 'frozen', daysRemaining: -10,
      })).toBe('متجمد')
    })

    it('applies the expiry thresholds at their exact boundaries', () => {
      const at = (daysRemaining: number) =>
        getComputedStatus({ subscriptionState: 'active', daysRemaining })

      expect(at(-1)).toBe('منتهي')
      expect(at(0)).toBe('ينتهي قريباً')
      expect(at(7)).toBe('ينتهي قريباً')
      expect(at(8)).toBe('نشط')
    })
  })

  describe('isPaused', () => {
    it('is true only for the paused status', () => {
      expect(isPaused({ subscriptionStatus: 'paused' })).toBe(true)
      expect(isPaused({ subscriptionStatus: 'frozen' })).toBe(false)
      expect(isPaused({})).toBe(false)
    })
  })

  describe('daysSince', () => {
    it('reads a Firestore Timestamp via toMillis', () => {
      freezeToday('2026-06-10T00:00:00Z')
      const ts = { toMillis: () => new Date('2026-06-05T00:00:00Z').getTime() }
      expect(daysSince(ts)).toBe(5)
    })

    it('reads the seconds field when toMillis is absent', () => {
      freezeToday('2026-06-10T00:00:00Z')
      expect(daysSince({ seconds: new Date('2026-06-01T00:00:00Z').getTime() / 1000 })).toBe(9)
    })

    it('reads an ISO string', () => {
      freezeToday('2026-06-10T00:00:00Z')
      expect(daysSince('2026-06-08T00:00:00Z')).toBe(2)
    })

    it('never returns a negative number for a future date', () => {
      freezeToday('2026-06-10T00:00:00Z')
      expect(daysSince('2026-07-01T00:00:00Z')).toBe(0)
    })

    it('returns 0 for empty input', () => {
      expect(daysSince(null)).toBe(0)
      expect(daysSince(undefined)).toBe(0)
      expect(daysSince('')).toBe(0)
    })
  })
})

describe('subscriber financials', () => {
  describe('calculateNetAmountUSD', () => {
    it('is paid minus refunds', () => {
      expect(calculateNetAmountUSD(subscriber({ paidAmountUSD: 150 }), 50)).toBe(100)
    })

    it('is the full paid amount when nothing was refunded', () => {
      expect(calculateNetAmountUSD(subscriber({ paidAmountUSD: 150 }))).toBe(150)
    })

    it('clamps at zero — an over-refund must never read as negative revenue', () => {
      expect(calculateNetAmountUSD(subscriber({ paidAmountUSD: 100 }), 150)).toBe(0)
    })

    it('treats a missing paid amount as zero', () => {
      expect(calculateNetAmountUSD(subscriber({ paidAmountUSD: undefined }), 0)).toBe(0)
    })
  })

  describe('getSubscriberFinancialSummary', () => {
    it('sums the refund history', () => {
      const summary = getSubscriberFinancialSummary(
        subscriber({ totalPriceUSD: 200, paidAmountUSD: 200 }),
        [{ refundAmountUSD: 30 }, { refundAmountUSD: 20 }]
      )
      expect(summary.previousRefundsTotal).toBe(50)
      expect(summary.remainingBalanceUSD).toBe(150)
    })

    it('reports zero refunds when there is no history', () => {
      const summary = getSubscriberFinancialSummary(
        subscriber({ totalPriceUSD: 200, paidAmountUSD: 120 })
      )
      expect(summary.previousRefundsTotal).toBe(0)
      expect(summary.remainingBalanceUSD).toBe(120)
      expect(summary.totalPriceUSD).toBe(200)
    })

    it('skips malformed refund rows instead of turning the total into NaN', () => {
      const summary = getSubscriberFinancialSummary(
        subscriber({ paidAmountUSD: 100 }),
        [{ refundAmountUSD: 40 }, { refundAmountUSD: undefined as unknown as number }]
      )
      expect(summary.previousRefundsTotal).toBe(40)
      expect(summary.remainingBalanceUSD).toBe(60)
    })

    it('clamps the remaining balance at zero', () => {
      const summary = getSubscriberFinancialSummary(
        subscriber({ paidAmountUSD: 50 }),
        [{ refundAmountUSD: 80 }]
      )
      expect(summary.remainingBalanceUSD).toBe(0)
    })

    it('carries the subscriber id and state through', () => {
      const summary = getSubscriberFinancialSummary(
        subscriber({ id: 'sub-99', subscriptionState: 'withdrawn' })
      )
      expect(summary.subscriberId).toBe('sub-99')
      expect(summary.status).toBe('withdrawn')
    })
  })

  describe('end-to-end: a partially refunded EGP subscription', () => {
    it('converts at the locked rate and nets out the refund', () => {
      // Sold for 4750 EGP when the rate was 47.5 → 100 USD.
      const lockedRates: ExchangeRates = { ...DEFAULT_RATES, EGP: 47.5 }
      const paidUSD = toUSD(4750, 'EGP', lockedRates)
      expect(paidUSD).toBeCloseTo(100, 6)

      // A 950 EGP refund is issued at the same locked rate → 20 USD.
      const refundUSD = toUSD(950, 'EGP', lockedRates)
      expect(refundUSD).toBeCloseTo(20, 6)

      const net = calculateNetAmountUSD(subscriber({ paidAmountUSD: paidUSD }), refundUSD)
      expect(net).toBeCloseTo(80, 6)
    })
  })
})
