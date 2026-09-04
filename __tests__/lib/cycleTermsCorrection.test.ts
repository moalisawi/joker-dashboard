import {
  CORRECTABLE_TERMS,
  MIN_REASON_LENGTH,
  applyCorrection,
  effectiveChanges,
  refuseCorrection,
  type CycleTermsState,
} from '@/lib/cycleTermsCorrection'
import { ROLE_CEILING } from '@/lib/permissions'

/**
 * Correcting the terms of a sale, as an operation rather than an edit.
 *
 * A price typed as 500 instead of 50 is not a payment recorded wrongly, and the
 * two must not share a mechanism: `adjustPayment` moves money that arrived and
 * refuses to let it pass the total, so it can never change what was invoiced.
 *
 * Almost every test below is a refusal. That is the shape of the feature — the
 * states in which a correction is safe are the minority, and each refusal here
 * traces to something concrete in the code rather than to caution.
 */

const REASON = 'السعر أُدخل ٥٠٠ بدل ٥٠ عند التسجيل'

/** A clean $50 monthly sale: paid in full, no schedule, no refund, never held. */
const clean: CycleTermsState = {
  totalPriceOriginal: 500,
  currencyOriginal: 'USD',
  lockedRate: 1,
  duration: 30,
  package: 'فضية',
  startDate: '2026-09-06',
  paidAmountUSD: 0,
  refundAmountUSD: 0,
  paymentCount: 0,
  refundCount: 0,
  installmentCount: 0,
  subscriptionState: 'active',
  subscriptionStatus: 'active',
}

const messages = (r: ReturnType<typeof refuseCorrection>) => r.map((x) => x.message).join(' ')

describe('what counts as a change', () => {
  it('ignores values that restate what is stored', () => {
    expect(effectiveChanges({ totalPriceOriginal: 500, package: 'فضية' }, clean)).toEqual([])
  })

  it('refuses a request that changes nothing', () => {
    const r = refuseCorrection({ totalPriceOriginal: 500 }, clean, REASON)
    expect(messages(r)).toContain('لا يوجد تغيير فعلي')
  })

  it('sees a real change', () => {
    expect(effectiveChanges({ totalPriceOriginal: 50 }, clean)).toEqual(['totalPriceOriginal'])
  })
})

describe('a reason is not optional', () => {
  it('refuses a missing reason', () => {
    expect(messages(refuseCorrection({ totalPriceOriginal: 50 }, clean, ''))).toContain('سبب التصحيح مطلوب')
  })

  it('refuses a reason too short to mean anything', () => {
    expect(messages(refuseCorrection({ totalPriceOriginal: 50 }, clean, 'خطأ'))).toContain('سبب التصحيح مطلوب')
    expect('خطأ'.length).toBeLessThan(MIN_REASON_LENGTH)
  })
})

describe('fields this operation refuses to own', () => {
  it('will not set an expiry date directly', () => {
    // Expiry is an output of start, duration, freeze, resume and renewal. A box
    // that sets it is a way to grant free service with nothing recording it.
    const r = refuseCorrection({ expiryDate: '2027-01-01' } as never, clean, REASON)
    expect(messages(r)).toContain('تاريخ الانتهاء يُحسب')
  })

  it('will not move the service start', () => {
    // revenueRecognition reads `startDate ?? date`; the monthly cohort reads
    // `date` alone. Correcting one without settling that moves revenue on one
    // screen and not the other.
    const r = refuseCorrection({ startDate: '2026-01-01' } as never, clean, REASON)
    expect(messages(r)).toContain('لا يمكن تصحيح')
  })

  it('owns exactly five terms', () => {
    expect([...CORRECTABLE_TERMS]).toEqual([
      'totalPriceOriginal', 'currencyOriginal', 'lockedRate', 'duration', 'package',
    ])
  })
})

describe('instalments make a money correction unanswerable', () => {
  const scheduled = { ...clean, installmentCount: 4, paymentCount: 1, paidAmountUSD: 12.5 }

  it('refuses a price change when a schedule exists', () => {
    // Every instalment is derived from the total and the rate, and each payment
    // records which instalment ids it was applied to. Re-deriving the schedule
    // would delete rows the payments still point at — and payments may not be
    // touched, so there is no correct answer.
    expect(messages(refuseCorrection({ totalPriceOriginal: 50 }, scheduled, REASON))).toContain('جدول أقساط')
  })

  it('refuses a rate or currency change when a schedule exists', () => {
    expect(messages(refuseCorrection({ lockedRate: 3.65 }, scheduled, REASON))).toContain('جدول أقساط')
    expect(messages(refuseCorrection({ currencyOriginal: 'ILS' }, scheduled, REASON))).toContain('جدول أقساط')
  })

  it('still allows the package label, which no amount derives from', () => {
    expect(refuseCorrection({ package: 'ذهبية' }, scheduled, REASON)).toEqual([])
  })
})

describe('the past is not repriced', () => {
  const paid = { ...clean, paymentCount: 2, paidAmountUSD: 50 }

  it('refuses a currency change once money has moved', () => {
    expect(messages(refuseCorrection({ currencyOriginal: 'ILS' }, paid, REASON))).toContain('إعادة تسعير للماضي')
  })

  it('refuses an exchange-rate change once money has moved', () => {
    expect(messages(refuseCorrection({ lockedRate: 3.65 }, paid, REASON))).toContain('إعادة تسعير للماضي')
  })

  it('still allows a price correction with payments, when nothing else blocks it', () => {
    // This is the case the operation exists for: $500 typed, $50 collected.
    expect(refuseCorrection({ totalPriceOriginal: 50 }, paid, REASON)).toEqual([])
  })

  it('refuses a price below what was already collected', () => {
    const r = refuseCorrection({ totalPriceOriginal: 20 }, paid, REASON)
    expect(messages(r)).toContain('أقل ممّا حُصّل')
    expect(messages(r)).toContain('استرداد')
  })
})

describe('refunds fix the meaning of the old price', () => {
  it('refuses a price change once a refund was calculated against it', () => {
    const refunded = { ...clean, refundCount: 1, refundAmountUSD: 10, paidAmountUSD: 0 }
    expect(messages(refuseCorrection({ totalPriceOriginal: 50 }, refunded, REASON))).toContain('استرداد')
  })
})

describe('a hold already rewrote the expiry', () => {
  it('refuses a duration change after a freeze or pause', () => {
    const held = { ...clean, everHeld: true }
    expect(messages(refuseCorrection({ duration: 60 }, held, REASON))).toContain('تلغي الأيام')
  })

  it('refuses any correction while currently frozen or paused', () => {
    expect(messages(refuseCorrection({ package: 'ذهبية' }, { ...clean, isFrozen: true }, REASON)))
      .toContain('استأنفه أولاً')
    expect(messages(refuseCorrection({ package: 'ذهبية' }, { ...clean, subscriptionStatus: 'paused' }, REASON)))
      .toContain('استأنفه أولاً')
  })
})

describe('withdrawal is terminal', () => {
  it('refuses every correction on a withdrawn subscriber', () => {
    const gone = { ...clean, subscriptionState: 'withdrawn' }
    expect(messages(refuseCorrection({ totalPriceOriginal: 50 }, gone, REASON))).toContain('منسحب')
  })
})

describe('every refusal is reported at once', () => {
  it('does not stop at the first', () => {
    const bad = { ...clean, installmentCount: 3, paymentCount: 1, subscriptionState: 'withdrawn' }
    const r = refuseCorrection({ currencyOriginal: 'ILS' }, bad, 'قصير')
    // reason + withdrawn + instalments + payments
    expect(r.length).toBeGreaterThanOrEqual(4)
  })
})

describe('what a correction actually writes', () => {
  const result = applyCorrection({ totalPriceOriginal: 50 }, { ...clean, paymentCount: 1, paidAmountUSD: 50 })

  it('recomputes the USD total and what is still owed', () => {
    expect(result.subscriberUpdate.totalPrice).toBe(50)
    expect(result.subscriberUpdate.totalPriceUSD).toBe(50)
    expect(result.subscriberUpdate.remainingAmountUSD).toBe(0)
  })

  it('writes the same terms onto the cycle and the invoice', () => {
    expect(result.cycleUpdate.totalPriceOriginal).toBe(50)
    expect(result.cycleUpdate.totalPriceUSD).toBe(50)
    expect(result.invoiceUpdate.totalUSD).toBe(50)
    expect(result.invoiceUpdate.totalOriginal).toBe(50)
  })

  it('creates no payment, no refund and no adjustment', () => {
    const written = JSON.stringify(result)
    for (const forbidden of ['paidAmountUSD', 'refundAmountUSD', 'netAmountUSD', 'amountOriginal']) {
      expect(written).not.toContain(forbidden)
    }
  })

  it('recomputes expiry from start and duration, never from an input', () => {
    const r = applyCorrection({ duration: 60 }, clean)
    expect(r.subscriberUpdate.expiryDate).toBe('2026-11-05') // 2026-09-06 + 60
    expect(r.before.expiryDate).toBe('2026-10-06')           // 2026-09-06 + 30
  })

  it('records both sides of every field it moved', () => {
    expect(result.fields).toEqual(['totalPriceOriginal'])
    expect(result.before).toMatchObject({ totalPriceOriginal: 500, totalPriceUSD: 500 })
    expect(result.after).toMatchObject({ totalPriceOriginal: 50, totalPriceUSD: 50 })
  })

  it('converts through the corrected rate', () => {
    const r = applyCorrection({ totalPriceOriginal: 365, lockedRate: 3.65 }, { ...clean, lockedRate: 1 })
    expect(r.subscriberUpdate.totalPriceUSD).toBe(100)
  })
})

describe('who may correct', () => {
  it('never an employee — the role ceiling withholds the capability', () => {
    // correctCycleTerms requires payments.refund, which the employee ceiling
    // denies, so no grant or job preset can reach it.
    expect(ROLE_CEILING.employee.payments.refund).toBe(false)
  })

  it('an admin and an owner hold it', () => {
    expect(ROLE_CEILING.admin.payments.refund).toBe(true)
    expect(ROLE_CEILING.owner.payments.refund).toBe(true)
  })
})
