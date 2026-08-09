/**
 * Unit tests for the subscriber-operations money and date arithmetic.
 *
 * `app/api/subscriber-operations/route.ts` runs eight financial transactions —
 * payment, renewal, withdrawal with refund, pause, freeze and the two resumes —
 * and had no coverage at all, which docs/SECURITY-HARDENING-2026-08.md flagged
 * as the largest remaining risk in the system. The calculations now live in
 * lib/subscriberFinance so they can be tested here without Firestore.
 *
 * What matters in these tests is not that the arithmetic runs, but that money
 * cannot go somewhere it should not: no negative revenue, no silent overpayment,
 * no day lost or gained on an expiry date.
 */
import {
  OVERPAY_TOLERANCE_USD,
  addDays,
  computePaymentUpdate,
  computeRenewalTotals,
  computeResumeExpiry,
  computeWithdrawalRefund,
  daysUsed,
  elapsedDaysSince,
  normalizeExchangeRate,
  remainingDays,
  resolveRenewalWindow,
  type SubscriberBalance,
} from '@/lib/subscriberFinance'

/** A subscriber priced at $100 with nothing paid yet. */
function balance(overrides: Partial<SubscriberBalance> = {}): SubscriberBalance {
  return {
    paidAmountUSD: 0,
    totalPriceUSD: 100,
    refundAmountUSD: 0,
    lockedRate: 1,
    ...overrides,
  }
}

// ─── exchange rates ─────────────────────────────────────────────────────────

describe('normalizeExchangeRate', () => {
  it('keeps a real rate untouched', () => {
    expect(normalizeExchangeRate(48.5)).toBe(48.5)
  })

  it('defaults a missing rate to 1', () => {
    // Number(null), Number('') and Number([]) are all 0 — finite, so a plain
    // asNumber fallback never fires and the rate floors to 0.000001 instead,
    // which turns a $50 payment into $50,000,000.
    expect(normalizeExchangeRate(undefined)).toBe(1)
    expect(normalizeExchangeRate(null)).toBe(1)
    expect(normalizeExchangeRate('')).toBe(1)
    expect(normalizeExchangeRate([])).toBe(1)
    expect(normalizeExchangeRate('not a number')).toBe(1)
  })

  it('falls back to the subscriber locked rate when one is supplied', () => {
    // createSubscriber uses the subscriber's locked rate when the initial
    // payment carries none of its own.
    expect(normalizeExchangeRate(undefined, 48.5)).toBe(48.5)
    expect(normalizeExchangeRate(null, 48.5)).toBe(48.5)
    expect(normalizeExchangeRate(50, 48.5)).toBe(50)
  })

  it('does not let a zero or negative rate through as a divisor', () => {
    expect(normalizeExchangeRate(0)).toBe(1)
    expect(normalizeExchangeRate(-5)).toBe(1)
    expect(100 / normalizeExchangeRate(0)).toBe(100)
  })
})

// ─── addPayment ─────────────────────────────────────────────────────────────

describe('computePaymentUpdate', () => {
  it('converts a local-currency payment and reduces the balance', () => {
    const result = computePaymentUpdate({
      amountOriginal: 2425, // EGP
      exchangeRate: 48.5,
      current: balance({ lockedRate: 48.5 }),
    })

    expect(result.amountUSD).toBeCloseTo(50, 10)
    expect(result.paidAmountUSD).toBeCloseTo(50, 10)
    expect(result.remainingAmountUSD).toBeCloseTo(50, 10)
    // The local-currency mirrors are the USD figures at the subscriber's locked rate.
    expect(result.paidAmount).toBeCloseTo(2425, 8)
    expect(result.remainingAmount).toBeCloseTo(2425, 8)
  })

  it('adds to what was already paid instead of replacing it', () => {
    const result = computePaymentUpdate({
      amountOriginal: 30,
      exchangeRate: 1,
      current: balance({ paidAmountUSD: 60 }),
    })

    expect(result.paidAmountUSD).toBe(90)
    expect(result.remainingAmountUSD).toBe(10)
  })

  it('rejects an amount that overshoots the subscription price', () => {
    expect(() =>
      computePaymentUpdate({
        amountOriginal: 50,
        exchangeRate: 1,
        current: balance({ paidAmountUSD: 80 }),
      })
    ).toThrow(/يتجاوز الإجمالي/)
  })

  it('accepts a final payment that lands a rounding cent over the total', () => {
    // 100 / 3 three times does not sum back to exactly 100 in binary floating
    // point. Without the tolerance the last instalment of a split payment is
    // rejected as an overpayment.
    const third = 100 / 3
    let current = balance()
    for (let i = 0; i < 3; i++) {
      const step = computePaymentUpdate({ amountOriginal: third, exchangeRate: 1, current })
      current = { ...current, paidAmountUSD: step.paidAmountUSD }
    }
    expect(current.paidAmountUSD).toBeCloseTo(100, 10)
  })

  it('rejects an overpayment larger than the tolerance', () => {
    expect(() =>
      computePaymentUpdate({
        amountOriginal: 100 + OVERPAY_TOLERANCE_USD * 3,
        exchangeRate: 1,
        current: balance(),
      })
    ).toThrow(/يتجاوز الإجمالي/)
  })

  it('does not cap a subscriber with no price set', () => {
    // totalPriceUSD 0 means the price was never recorded, not that it is free.
    const result = computePaymentUpdate({
      amountOriginal: 500,
      exchangeRate: 1,
      current: balance({ totalPriceUSD: 0 }),
    })
    expect(result.paidAmountUSD).toBe(500)
    expect(result.remainingAmountUSD).toBe(0)
  })

  it('rejects zero and negative amounts', () => {
    for (const amountOriginal of [0, -1, -0.01]) {
      expect(() =>
        computePaymentUpdate({ amountOriginal, exchangeRate: 1, current: balance() })
      ).toThrow(/greater than zero/)
    }
  })

  it('never reports negative net revenue when refunds exceed payments', () => {
    const result = computePaymentUpdate({
      amountOriginal: 10,
      exchangeRate: 1,
      current: balance({ refundAmountUSD: 90 }),
    })
    expect(result.netAmountUSD).toBe(0)
  })

  it('never reports a negative remaining balance', () => {
    const result = computePaymentUpdate({
      amountOriginal: 100.005, // inside tolerance, still above the total
      exchangeRate: 1,
      current: balance(),
    })
    expect(result.remainingAmountUSD).toBe(0)
  })
})

// ─── renewSubscription ──────────────────────────────────────────────────────

describe('computeRenewalTotals', () => {
  it('treats a null paid amount as paid in full', () => {
    // The renewal dialog omits paidAmount when the user does not touch the field.
    const result = computeRenewalTotals({ totalPrice: 100, paidAmount: null, exchangeRate: 1 })
    expect(result.paidAmount).toBe(100)
    expect(result.remaining).toBe(0)
    expect(result.remainingUSD).toBe(0)
  })

  it('distinguishes an explicit zero from a missing amount', () => {
    const result = computeRenewalTotals({ totalPrice: 100, paidAmount: 0, exchangeRate: 1 })
    expect(result.paidAmount).toBe(0)
    expect(result.remaining).toBe(100)
  })

  it('converts a partial renewal payment at the renewal rate', () => {
    const result = computeRenewalTotals({ totalPrice: 4850, paidAmount: 2425, exchangeRate: 48.5 })
    expect(result.totalPriceUSD).toBeCloseTo(100, 10)
    expect(result.paidUSD).toBeCloseTo(50, 10)
    expect(result.remainingUSD).toBeCloseTo(50, 10)
  })

  it('does not report a negative remainder when the customer overpays', () => {
    const result = computeRenewalTotals({ totalPrice: 100, paidAmount: 150, exchangeRate: 1 })
    expect(result.remaining).toBe(0)
    expect(result.netAmountUSD).toBe(150)
  })
})

describe('resolveRenewalWindow', () => {
  it('appends the new term to the old expiry when renewing early', () => {
    // Renewing a week early must not throw that week away.
    const { startDate, endDate } = resolveRenewalWindow({
      subscriptionState: 'active',
      currentExpiryDate: '2026-06-15',
      renewalDate: '2026-06-08',
      duration: 30,
    })
    expect(startDate).toBe('2026-06-15')
    expect(endDate).toBe('2026-07-15')
  })

  it('starts from the renewal date when the subscription already expired', () => {
    const { startDate, endDate } = resolveRenewalWindow({
      subscriptionState: 'active',
      currentExpiryDate: '2026-06-01',
      renewalDate: '2026-06-08',
      duration: 30,
    })
    expect(startDate).toBe('2026-06-08')
    expect(endDate).toBe('2026-07-08')
  })

  it('starts from the renewal date for a withdrawn subscriber even with days left', () => {
    // A withdrawn subscriber coming back does not get the unused tail of the
    // cycle they walked away from.
    const { startDate } = resolveRenewalWindow({
      subscriptionState: 'withdrawn',
      currentExpiryDate: '2026-06-15',
      renewalDate: '2026-06-08',
      duration: 30,
    })
    expect(startDate).toBe('2026-06-08')
  })

  it('treats an expiry falling on the renewal date as no days left', () => {
    const { startDate } = resolveRenewalWindow({
      subscriptionState: 'active',
      currentExpiryDate: '2026-06-08',
      renewalDate: '2026-06-08',
      duration: 30,
    })
    expect(startDate).toBe('2026-06-08')
  })

  it('falls back to the renewal date when the subscriber has no expiry recorded', () => {
    const { startDate, endDate } = resolveRenewalWindow({
      subscriptionState: 'active',
      currentExpiryDate: '',
      renewalDate: '2026-06-08',
      duration: 30,
    })
    expect(startDate).toBe('2026-06-08')
    expect(endDate).toBe('2026-07-08')
  })
})

// ─── withdrawSubscriber ─────────────────────────────────────────────────────

describe('computeWithdrawalRefund', () => {
  it('converts the refund and subtracts it from revenue', () => {
    const result = computeWithdrawalRefund({
      refundAmount: 1455,
      exchangeRate: 48.5,
      previousRefundUSD: 0,
      paidAmountUSD: 100,
    })
    expect(result.refundAmountUSD).toBeCloseTo(30, 10)
    expect(result.hasRefund).toBe(true)
    expect(result.netAmountUSD).toBeCloseTo(70, 10)
  })

  it('accumulates on top of an earlier refund', () => {
    const result = computeWithdrawalRefund({
      refundAmount: 20,
      exchangeRate: 1,
      previousRefundUSD: 30,
      paidAmountUSD: 100,
    })
    expect(result.newRefundAmountUSD).toBe(50)
    expect(result.netAmountUSD).toBe(50)
  })

  it('floors net revenue at zero when the refund exceeds everything paid', () => {
    const result = computeWithdrawalRefund({
      refundAmount: 150,
      exchangeRate: 1,
      previousRefundUSD: 0,
      paidAmountUSD: 100,
    })
    expect(result.netAmountUSD).toBe(0)
  })

  it('treats a withdrawal with no refund as a no-op on the money', () => {
    const result = computeWithdrawalRefund({
      refundAmount: 0,
      exchangeRate: 48.5,
      previousRefundUSD: 12,
      paidAmountUSD: 100,
    })
    expect(result.refundAmountUSD).toBe(0)
    expect(result.hasRefund).toBe(false)
    expect(result.newRefundAmountUSD).toBe(12)
    expect(result.netAmountUSD).toBe(88)
  })

  it('ignores a negative refund amount instead of crediting the subscriber', () => {
    const result = computeWithdrawalRefund({
      refundAmount: -50,
      exchangeRate: 1,
      previousRefundUSD: 0,
      paidAmountUSD: 100,
    })
    expect(result.refundAmountUSD).toBe(0)
    expect(result.netAmountUSD).toBe(100)
  })
})

// ─── pause / freeze / resume ────────────────────────────────────────────────

describe('computeResumeExpiry', () => {
  it('grants the preserved days again from the resume date', () => {
    expect(computeResumeExpiry(12, '2026-06-08')).toBe('2026-06-20')
  })

  it('does not extend a subscription that had no days left', () => {
    expect(computeResumeExpiry(0, '2026-06-08')).toBe('2026-06-08')
  })

  it('never moves the expiry backwards on corrupt data', () => {
    expect(computeResumeExpiry(-30, '2026-06-08')).toBe('2026-06-08')
  })
})

describe('elapsedDaysSince', () => {
  const noon = Date.UTC(2026, 5, 8, 12, 0, 0)

  it('counts a part-day pause as one day', () => {
    expect(elapsedDaysSince(noon - 3 * 3600_000, noon)).toBe(1)
  })

  it('counts whole days', () => {
    expect(elapsedDaysSince(noon - 5 * 86_400_000, noon)).toBe(5)
  })

  it('returns zero when the timestamp is missing', () => {
    // Legacy records paused before pausedAt was written have no timestamp.
    expect(elapsedDaysSince(null, noon)).toBe(0)
  })

  it('does not return negative days from a clock skew', () => {
    expect(elapsedDaysSince(noon + 86_400_000, noon)).toBe(0)
  })
})

// ─── date arithmetic ────────────────────────────────────────────────────────

describe('date helpers', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-06-15', 30)).toBe('2026-07-15')
  })

  it('adds days across a year boundary', () => {
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19')
  })

  it('handles February in a leap year', () => {
    expect(addDays('2028-02-27', 3)).toBe('2028-03-01')
    expect(addDays('2027-02-27', 3)).toBe('2027-03-02')
  })

  it('counts days used from the start date', () => {
    expect(daysUsed('2026-06-01', '2026-06-15')).toBe(14)
  })

  it('never reports negative days used for a start date in the future', () => {
    expect(daysUsed('2026-07-01', '2026-06-15')).toBe(0)
  })

  it('counts days remaining before expiry', () => {
    expect(remainingDays('2026-06-15', '2026-06-01')).toBe(14)
  })

  it('reports zero remaining on and after the expiry date', () => {
    expect(remainingDays('2026-06-15', '2026-06-15')).toBe(0)
    expect(remainingDays('2026-06-15', '2026-06-20')).toBe(0)
  })
})

/**
 * The same assertions run under four timezones. `new Date("2026-06-10")` is
 * parsed as UTC midnight while `getDate`/`setDate` read local components, so
 * date maths written the obvious way is correct in UTC and off by a day west
 * of it. Production runs on Vercel in UTC and hid this; a developer machine in
 * Cairo, or a future move to a regional runtime, would not.
 */
describe.each([
  ['Asia/Jerusalem', 'UTC+2/+3'],
  ['UTC', 'UTC'],
  ['America/New_York', 'UTC-4/-5'],
  ['Pacific/Auckland', 'UTC+12/+13'],
])('date maths in %s (%s)', (timeZone) => {
  const original = process.env.TZ

  beforeAll(() => {
    process.env.TZ = timeZone
  })

  afterAll(() => {
    process.env.TZ = original
  })

  it('adds a 30-day term without drifting', () => {
    expect(addDays('2026-06-10', 30)).toBe('2026-07-10')
  })

  it('keeps the renewal window stable', () => {
    const { startDate, endDate } = resolveRenewalWindow({
      subscriptionState: 'active',
      currentExpiryDate: '2026-06-15',
      renewalDate: '2026-06-08',
      duration: 30,
    })
    expect(startDate).toBe('2026-06-15')
    expect(endDate).toBe('2026-07-15')
  })

  it('preserves the resume expiry', () => {
    expect(computeResumeExpiry(12, '2026-06-08')).toBe('2026-06-20')
  })

  it('counts remaining days identically', () => {
    expect(remainingDays('2026-06-15', '2026-06-01')).toBe(14)
  })
})
