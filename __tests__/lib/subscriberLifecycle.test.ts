/**
 * The subscriber lifecycle: status derivation, instalment schedules, payment
 * allocation, and the legacy fallback.
 *
 * These are the calculations that decide what a customer is told they owe and
 * when. A wrong answer here does not crash anything — it produces a confident
 * number that is wrong, which is the failure mode this whole file exists to
 * prevent. Three properties matter most and each has its own block below:
 *
 *  1. A schedule always sums back to exactly what was financed. Rounding three
 *     ways into cents and losing one leaves an invoice that can never reach paid.
 *  2. Allocation never invents or destroys money: what goes in either lands on
 *     an instalment or comes back as unallocated.
 *  3. A subscriber with no ledger still derives a correct, complete view. That
 *     is every record created before this shipped, and the migration is optional
 *     by design.
 */
import {
  deriveOperationalStatus,
  deriveBillingStatus,
  deriveRenewalStatus,
  deriveInstallmentStatus,
  legacyToCurrentCycleView,
  generateInstallmentSchedule,
  allocatePaymentToInstallments,
  summarizeAging,
  agingBucketFor,
  resolveReceiptStatus,
  formatInvoiceNumber,
  operationalToCycleStatus,
  summarizePlan,
  RENEWAL_WINDOW_DAYS,
  isActiveNow,
  isInCustomerBase,
  isExpiringWithin,
  deletedSubscriberIds,
  omitDeletedSubscriberRows,
  type AllocatableInstallment,
} from '@/lib/subscriberLifecycle'
import type { SubscriptionCycle } from '@/types/billing'

const TODAY = '2026-08-12'

// ─── Operational status ───────────────────────────────────────────────────────

describe('deriveOperationalStatus', () => {
  it('treats withdrawal as terminal, above every other hold', () => {
    expect(deriveOperationalStatus(
      { subscriptionState: 'withdrawn', subscriptionStatus: 'paused', freezeData: { isFrozen: true } },
      TODAY
    )).toBe('withdrawn')
  })

  it('ranks a freeze above a pause', () => {
    expect(deriveOperationalStatus(
      { subscriptionStatus: 'paused', freezeData: { isFrozen: true }, expiryDate: '2026-12-01' },
      TODAY
    )).toBe('frozen')
  })

  it('reports a deliberate hold rather than expiry, even past the expiry date', () => {
    // The subscription is paused AND expired. Reporting "منتهي" would hide the
    // fact that someone stopped it on purpose and it is waiting to resume.
    expect(deriveOperationalStatus(
      { subscriptionStatus: 'paused', expiryDate: '2026-01-01' },
      TODAY
    )).toBe('paused')
  })

  it('expires only when no hold applies', () => {
    expect(deriveOperationalStatus({ expiryDate: '2026-01-01' }, TODAY)).toBe('expired')
    expect(deriveOperationalStatus({ expiryDate: '2026-12-01' }, TODAY)).toBe('active')
  })

  it('prefers the cycle expiry over the subscriber one when a cycle exists', () => {
    const cycle = { status: 'active' as const, expiryDate: '2026-12-01' }
    expect(deriveOperationalStatus({ expiryDate: '2026-01-01' }, TODAY, cycle)).toBe('active')
  })
})

// ─── Billing status ───────────────────────────────────────────────────────────

describe('deriveBillingStatus', () => {
  it('settles within the one-cent conversion tolerance', () => {
    // $99.995 against $100 is a fully-settled invoice, not a debt of half a cent.
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 99.995 }, TODAY)).toBe('paid')
  })

  it('separates overdue from partially paid by the due date', () => {
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 40, dueDate: '2026-09-01' }, TODAY)).toBe('partially_paid')
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 40, dueDate: '2026-07-01' }, TODAY)).toBe('overdue')
  })

  it('reports an unpaid invoice past its due date as overdue, not merely issued', () => {
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 0, dueDate: '2026-07-01' }, TODAY)).toBe('overdue')
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 0, dueDate: '2026-09-01' }, TODAY)).toBe('issued')
  })

  it('distinguishes refunded from never paid', () => {
    // Money in and back out is a different outcome from money that never came.
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 100, refundedUSD: 100 }, TODAY)).toBe('refunded')
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 0, refundedUSD: 0 }, TODAY)).not.toBe('refunded')
  })

  it('never reports a voided invoice as anything else', () => {
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 100, voided: true }, TODAY)).toBe('void')
  })

  it('treats a free subscription as paid rather than perpetually unpaid', () => {
    expect(deriveBillingStatus({ totalUSD: 0, paidUSD: 0 }, TODAY)).toBe('paid')
  })

  it('cannot be overdue with no due date', () => {
    expect(deriveBillingStatus({ totalUSD: 100, paidUSD: 10 }, TODAY)).toBe('partially_paid')
  })
})

// ─── Renewal status ───────────────────────────────────────────────────────────

describe('deriveRenewalStatus', () => {
  it('lets a recorded human outcome win over the calendar', () => {
    // Someone spoke to this customer. Resetting them to "حان التجديد" every
    // morning is how a follow-up queue stops being trusted.
    expect(deriveRenewalStatus({ expiryDate: '2026-08-15', renewalWorkflowStatus: 'promised' }, TODAY)).toBe('promised')
    expect(deriveRenewalStatus({ expiryDate: '2026-01-01', renewalWorkflowStatus: 'renewed' }, TODAY)).toBe('renewed')
    expect(deriveRenewalStatus({ expiryDate: '2026-08-15', renewalWorkflowStatus: 'declined' }, TODAY)).toBe('declined')
  })

  it('derives the window from the expiry date when nothing was recorded', () => {
    const inWindow = (days: number) => {
      const d = new Date(Date.UTC(2026, 7, 12) + days * 86_400_000).toISOString().slice(0, 10)
      return deriveRenewalStatus({ expiryDate: d }, TODAY)
    }
    expect(inWindow(RENEWAL_WINDOW_DAYS.due - 1)).toBe('due')
    expect(inWindow(RENEWAL_WINDOW_DAYS.upcoming - 1)).toBe('upcoming')
    expect(inWindow(RENEWAL_WINDOW_DAYS.upcoming + 10)).toBe('not_due')
    expect(inWindow(-1)).toBe('expired')
  })

  it('does not chase a withdrawn subscriber for renewal', () => {
    expect(deriveRenewalStatus({ expiryDate: '2026-08-15', subscriptionState: 'withdrawn' }, TODAY)).toBe('not_due')
  })
})

// ─── Legacy fallback ──────────────────────────────────────────────────────────

describe('legacyToCurrentCycleView', () => {
  const legacy = {
    package: 'ذهبية', duration: 90, startDate: '2026-05-01', expiryDate: '2026-07-30',
    currencyOriginal: 'EGP', lockedRate: 48,
    totalPriceUSD: 200, paidAmountUSD: 120, remainingAmountUSD: 80,
    refundAmountUSD: 0, netAmountUSD: 120, renewalCount: 2,
  }

  it('reconstructs a complete view from the subscriber alone', () => {
    const view = legacyToCurrentCycleView(legacy)
    expect(view).toMatchObject({
      cycleId: null, package: 'ذهبية', duration: 90,
      totalPriceUSD: 200, paidAmountUSD: 120, remainingAmountUSD: 80,
      fromCycleDocument: false,
    })
  })

  it('numbers the cycle one above the renewal count', () => {
    // Two renewals means the subscriber is in their third cycle.
    expect(legacyToCurrentCycleView(legacy).cycleNumber).toBe(3)
    expect(legacyToCurrentCycleView({ ...legacy, renewalCount: 0 }).cycleNumber).toBe(1)
  })

  it('recomputes a missing remaining balance instead of reporting zero', () => {
    const { remainingAmountUSD } = legacyToCurrentCycleView({
      ...legacy, remainingAmountUSD: undefined,
    })
    expect(remainingAmountUSD).toBe(80)
  })

  it('prefers the cycle document when one exists and flags the difference', () => {
    const cycle = {
      id: 'c1', cycleNumber: 4, package: 'فضية', duration: 30,
      startDate: '2026-08-01', expiryDate: '2026-08-31',
      currencyOriginal: 'USD', exchangeRate: 1,
      totalPriceUSD: 50, paidAmountUSD: 50, remainingAmountUSD: 0,
      refundAmountUSD: 0, netAmountUSD: 50,
    } as unknown as SubscriptionCycle

    const view = legacyToCurrentCycleView(legacy, cycle)
    expect(view.cycleNumber).toBe(4)
    expect(view.totalPriceUSD).toBe(50)
    expect(view.fromCycleDocument).toBe(true)
  })
})

// ─── Instalment schedules ─────────────────────────────────────────────────────

describe('generateInstallmentSchedule', () => {
  const base = { totalOriginal: 100, exchangeRate: 1, firstDueDate: '2026-09-01', frequency: 'monthly' as const }

  it('sums back to exactly the financed amount despite rounding', () => {
    // $100 / 3 rounds to 33.33 each = 99.99. The last instalment absorbs the
    // difference, or the invoice can never reach paid.
    const s = generateInstallmentSchedule({ ...base, count: 3 })
    expect(s.reduce((n, i) => n + i.amountOriginal, 0)).toBeCloseTo(100, 10)
    expect(s[2].amountOriginal).toBeCloseTo(33.34, 10)
  })

  it('excludes the down payment from what gets scheduled', () => {
    const s = generateInstallmentSchedule({ ...base, count: 2, downPaymentOriginal: 40 })
    expect(s.reduce((n, i) => n + i.amountOriginal, 0)).toBeCloseTo(60, 10)
  })

  it('spaces due dates by frequency', () => {
    expect(generateInstallmentSchedule({ ...base, count: 3 }).map((i) => i.dueDate))
      .toEqual(['2026-09-01', '2026-10-01', '2026-10-31'])
    expect(generateInstallmentSchedule({ ...base, count: 3, frequency: 'weekly' }).map((i) => i.dueDate))
      .toEqual(['2026-09-01', '2026-09-08', '2026-09-15'])
  })

  it('honours explicit dates for a custom plan', () => {
    const dates = ['2026-09-05', '2026-11-20']
    expect(generateInstallmentSchedule({ ...base, count: 2, frequency: 'custom', customDates: dates })
      .map((i) => i.dueDate)).toEqual(dates)
  })

  it('rejects a custom plan whose dates do not match the count', () => {
    expect(() => generateInstallmentSchedule({
      ...base, count: 3, frequency: 'custom', customDates: ['2026-09-05'],
    })).toThrow()
  })

  it('converts to USD at the given rate', () => {
    const s = generateInstallmentSchedule({ ...base, totalOriginal: 480, exchangeRate: 48, count: 2 })
    expect(s[0].amountUSD).toBeCloseTo(5, 10)
  })

  it('refuses a schedule it cannot produce', () => {
    expect(() => generateInstallmentSchedule({ ...base, count: 0 })).toThrow()
    expect(() => generateInstallmentSchedule({ ...base, count: 61 })).toThrow()
    expect(() => generateInstallmentSchedule({ ...base, count: 2, downPaymentOriginal: 100 })).toThrow()
  })
})

// ─── Allocation ───────────────────────────────────────────────────────────────

function inst(over: Partial<AllocatableInstallment> & { id: string }): AllocatableInstallment {
  return {
    installmentNumber: 1, dueDate: '2026-09-01', amountUSD: 50, paidUSD: 0, status: 'pending', ...over,
  }
}

describe('allocatePaymentToInstallments', () => {
  const schedule = [
    inst({ id: 'a', installmentNumber: 1, dueDate: '2026-09-01' }),
    inst({ id: 'b', installmentNumber: 2, dueDate: '2026-10-01' }),
    inst({ id: 'c', installmentNumber: 3, dueDate: '2026-11-01' }),
  ]

  it('settles the oldest due instalment first', () => {
    const { allocations } = allocatePaymentToInstallments(50, schedule)
    expect(allocations).toHaveLength(1)
    expect(allocations[0]).toMatchObject({ installmentId: 'a', appliedUSD: 50, status: 'paid' })
  })

  it('spreads a payment that covers more than one instalment', () => {
    // Customers routinely pay two months at once; refusing that would strand
    // the money as an unallocated lump.
    const { allocations, unallocatedUSD } = allocatePaymentToInstallments(120, schedule)
    expect(allocations.map((a) => a.appliedUSD)).toEqual([50, 50, 20])
    expect(allocations[2].status).toBe('partially_paid')
    expect(unallocatedUSD).toBe(0)
  })

  it('conserves money — allocated plus unallocated equals what came in', () => {
    for (const amount of [10, 50, 75, 150, 500]) {
      const { allocations, unallocatedUSD } = allocatePaymentToInstallments(amount, schedule)
      const applied = allocations.reduce((n, a) => n + a.appliedUSD, 0)
      expect(applied + unallocatedUSD).toBeCloseTo(amount, 10)
    }
  })

  it('returns the excess rather than overpaying a schedule', () => {
    const { unallocatedUSD } = allocatePaymentToInstallments(500, schedule)
    expect(unallocatedUSD).toBeCloseTo(350, 10)
  })

  it('puts a named instalment at the front of the queue', () => {
    const { allocations } = allocatePaymentToInstallments(50, schedule, 'c')
    expect(allocations[0].installmentId).toBe('c')
  })

  it('continues oldest-first after settling the named instalment', () => {
    const { allocations } = allocatePaymentToInstallments(60, schedule, 'c')
    expect(allocations.map((a) => a.installmentId)).toEqual(['c', 'a'])
  })

  it('skips instalments that are settled, waived or cancelled', () => {
    const mixed = [
      inst({ id: 'a', installmentNumber: 1, status: 'paid', paidUSD: 50 }),
      inst({ id: 'b', installmentNumber: 2, dueDate: '2026-10-01', status: 'waived' }),
      inst({ id: 'c', installmentNumber: 3, dueDate: '2026-11-01', status: 'cancelled' }),
      inst({ id: 'd', installmentNumber: 4, dueDate: '2026-12-01' }),
    ]
    const { allocations } = allocatePaymentToInstallments(50, mixed)
    expect(allocations.map((a) => a.installmentId)).toEqual(['d'])
  })

  it('tops up a partially paid instalment before moving on', () => {
    const partial = [
      inst({ id: 'a', installmentNumber: 1, paidUSD: 30, status: 'partially_paid' }),
      inst({ id: 'b', installmentNumber: 2, dueDate: '2026-10-01' }),
    ]
    const { allocations } = allocatePaymentToInstallments(20, partial)
    expect(allocations[0]).toMatchObject({ installmentId: 'a', appliedUSD: 20, status: 'paid' })
  })

  it('does nothing with a non-positive amount', () => {
    expect(allocatePaymentToInstallments(0, schedule).allocations).toEqual([])
    expect(allocatePaymentToInstallments(-5, schedule).allocations).toEqual([])
  })
})

// ─── Instalment status ────────────────────────────────────────────────────────

describe('deriveInstallmentStatus', () => {
  it('becomes overdue by the passage of time, not by a write', () => {
    // Nothing rewrites instalment documents nightly, so the status has to be
    // recomputed on read or an overdue instalment reads as pending forever.
    expect(deriveInstallmentStatus(
      { amountUSD: 50, paidUSD: 0, dueDate: '2026-07-01', status: 'pending' }, TODAY
    )).toBe('overdue')
  })

  it('never recomputes a decision a human made', () => {
    expect(deriveInstallmentStatus(
      { amountUSD: 50, paidUSD: 0, dueDate: '2026-01-01', status: 'waived' }, TODAY
    )).toBe('waived')
    expect(deriveInstallmentStatus(
      { amountUSD: 50, paidUSD: 0, dueDate: '2026-01-01', status: 'cancelled' }, TODAY
    )).toBe('cancelled')
  })

  it('settles within tolerance', () => {
    expect(deriveInstallmentStatus(
      { amountUSD: 50, paidUSD: 49.995, dueDate: '2026-01-01', status: 'pending' }, TODAY
    )).toBe('paid')
  })
})

// ─── AR aging ─────────────────────────────────────────────────────────────────

describe('aging', () => {
  it('buckets by how late, not by how much', () => {
    expect(agingBucketFor('2026-09-01', TODAY)).toBe('not_due')
    expect(agingBucketFor(TODAY, TODAY)).toBe('due_today')
    expect(agingBucketFor('2026-08-08', TODAY)).toBe('d1_7')
    expect(agingBucketFor('2026-07-20', TODAY)).toBe('d8_30')
    expect(agingBucketFor('2026-05-01', TODAY)).toBe('d31_plus')
  })

  it('counts only what is actually outstanding', () => {
    const summary = summarizeAging([
      { dueDate: '2026-07-01', amountUSD: 50, paidUSD: 20, status: 'partially_paid' },
      { dueDate: '2026-07-01', amountUSD: 50, paidUSD: 50, status: 'paid' },
      { dueDate: '2026-07-01', amountUSD: 50, paidUSD: 0,  status: 'waived' },
      { dueDate: '2026-09-01', amountUSD: 40, paidUSD: 0,  status: 'pending' },
    ], TODAY)

    expect(summary.d31_plus).toEqual({ count: 1, amountUSD: 30 })
    expect(summary.not_due).toEqual({ count: 1, amountUSD: 40 })
    expect(summary.d1_7.count).toBe(0)
  })
})

// ─── Receipts ─────────────────────────────────────────────────────────────────

describe('resolveReceiptStatus', () => {
  it('does not call an unreviewed historical upload verified', () => {
    // Marking thousands of old uploads "verified" would make the word mean
    // nothing on the day someone starts actually checking them.
    expect(resolveReceiptStatus({ receiptUrl: 'https://x/y.png' })).toBe('pending_review')
  })

  it('reports a payment with no receipt as missing', () => {
    expect(resolveReceiptStatus({})).toBe('missing')
    expect(resolveReceiptStatus({ receiptUrl: null })).toBe('missing')
  })

  it('passes a recorded decision through unchanged', () => {
    expect(resolveReceiptStatus({ receiptStatus: 'verified', receiptUrl: 'u' })).toBe('verified')
    expect(resolveReceiptStatus({ receiptStatus: 'rejected', receiptUrl: 'u' })).toBe('rejected')
  })
})

// ─── Misc ─────────────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('formats a sortable, zero-padded invoice number', () => {
    expect(formatInvoiceNumber(2026, 42)).toBe('INV-2026-000042')
    expect(formatInvoiceNumber(2026, 1)).toBe('INV-2026-000001')
  })

  it('maps operational status onto a cycle status', () => {
    expect(operationalToCycleStatus('expired')).toBe('completed')
    expect(operationalToCycleStatus('withdrawn')).toBe('withdrawn')
    expect(operationalToCycleStatus('active')).toBe('active')
  })

  it('summarises a plan for the pre-save preview', () => {
    const schedule = generateInstallmentSchedule({
      totalOriginal: 100, exchangeRate: 1, count: 2, firstDueDate: '2026-09-01', frequency: 'monthly',
      downPaymentOriginal: 20,
    })
    expect(summarizePlan(100, 20, schedule)).toMatchObject({
      planType: 'installments', installmentCount: 2,
      firstDueDate: '2026-09-01', lastDueDate: '2026-10-01',
    })
    expect(summarizePlan(100, 100, []).planType).toBe('full')
  })
})

/*
 * Soft-deleted subscribers must not leak into financial totals.
 *
 * This is a regression block, not a hypothetical. On 31 Aug 2026 the finance
 * page on production was reading `subscribers` with soft-deleted rows removed
 * but `payments`, `invoices` and `installments` unfiltered. Every invoice and
 * every instalment on that deployment belonged to a deleted subscriber, so the
 * page reported $600 outstanding and $950 collected against people the
 * subscribers screen said did not exist — and no screen showed the
 * contradiction, because each number looked plausible on its own.
 */
describe("soft-deleted subscribers are excluded from ledger totals", () => {
  const subscribers = [
    { id: "live-1" },
    { id: "live-2", deleted: false },
    { id: "gone-1", deleted: true },
  ];

  it("collects only the ids actually flagged deleted", () => {
    const ids = deletedSubscriberIds(subscribers);
    expect([...ids]).toEqual(["gone-1"]);
  });

  it("drops rows belonging to a deleted subscriber", () => {
    const rows = [
      { subscriberId: "live-1", amountUSD: 100 },
      { subscriberId: "gone-1", amountUSD: 250 },
      { subscriberId: "live-2", amountUSD: 50 },
    ];
    const kept = omitDeletedSubscriberRows(rows, deletedSubscriberIds(subscribers));
    expect(kept.map((r) => r.subscriberId)).toEqual(["live-1", "live-2"]);
    expect(kept.reduce((n, r) => n + r.amountUSD, 0)).toBe(150);
  });

  it("keeps an unattributable row rather than silently understating the total", () => {
    // No subscriberId means it cannot be judged either way. Dropping it would
    // trade one wrong number for a different wrong number.
    const rows = [{ amountUSD: 40 }, { subscriberId: "gone-1", amountUSD: 250 }];
    const kept = omitDeletedSubscriberRows(rows, deletedSubscriberIds(subscribers));
    expect(kept).toHaveLength(1);
    expect(kept[0].amountUSD).toBe(40);
  });

  it("changes nothing when no subscriber is deleted", () => {
    const rows = [{ subscriberId: "live-1" }, { subscriberId: "live-2" }];
    expect(omitDeletedSubscriberRows(rows, deletedSubscriberIds([{ id: "live-1" }]))).toEqual(rows);
  });
});

/*
 * One definition of "active", tested at the edges.
 *
 * Three screens each rewrote this rule inline and produced 44, 8 and a third
 * number from the same 51 subscribers. The case that matters most is the
 * expiring-soon one: getComputedStatus() labels a subscriber with five days left
 * "ينتهي قريباً" rather than "نشط", and the dashboard filtered on that label —
 * so people who were paying, valid, and most in need of a renewal call were
 * missing from the active count.
 */
describe('who counts as a customer', () => {
  const live = { subscriptionState: 'active', daysRemaining: 30 }

  describe('isActiveNow', () => {
    it('counts a plainly active subscription', () => {
      expect(isActiveNow(live)).toBe(true)
    })

    it('counts one expiring in three days — still valid, still paying', () => {
      expect(isActiveNow({ ...live, daysRemaining: 3 })).toBe(true)
    })

    it('counts one expiring today', () => {
      expect(isActiveNow({ ...live, daysRemaining: 0 })).toBe(true)
    })

    it('excludes one that expired yesterday', () => {
      expect(isActiveNow({ ...live, daysRemaining: -1 })).toBe(false)
    })

    it('excludes withdrawn, paused and frozen', () => {
      expect(isActiveNow({ ...live, subscriptionState: 'withdrawn' })).toBe(false)
      expect(isActiveNow({ ...live, subscriptionStatus: 'paused' })).toBe(false)
      expect(isActiveNow({ ...live, subscriptionStatus: 'frozen' })).toBe(false)
    })

    it('honours freezeData.isFrozen, the other way frozen is stored', () => {
      expect(isActiveNow({ ...live, freezeData: { isFrozen: true } })).toBe(false)
    })

    it('excludes a record with no daysRemaining rather than guessing', () => {
      expect(isActiveNow({ subscriptionState: 'active' })).toBe(false)
    })
  })

  describe('isInCustomerBase', () => {
    it('keeps an expired subscriber — still winnable', () => {
      expect(isInCustomerBase({ ...live, daysRemaining: -90 })).toBe(true)
    })

    it('keeps paused and frozen subscribers', () => {
      expect(isInCustomerBase({ ...live, subscriptionStatus: 'paused' })).toBe(true)
    })

    it('drops only the withdrawn', () => {
      expect(isInCustomerBase({ ...live, subscriptionState: 'withdrawn' })).toBe(false)
    })
  })

  describe('the two answers differ, which is the whole point', () => {
    const book = [
      { subscriptionState: 'active', daysRemaining: 30 },
      { subscriptionState: 'active', daysRemaining: 3 },
      { subscriptionState: 'active', daysRemaining: -40 },
      { subscriptionState: 'active', subscriptionStatus: 'paused', daysRemaining: 10 },
      { subscriptionState: 'withdrawn', daysRemaining: 10 },
    ]
    it('counts 2 active now and 4 in the customer base', () => {
      expect(book.filter(isActiveNow)).toHaveLength(2)
      expect(book.filter(isInCustomerBase)).toHaveLength(4)
    })
  })

  describe('isExpiringWithin', () => {
    it('is the renewal call list: active AND close to expiry', () => {
      expect(isExpiringWithin({ ...live, daysRemaining: 5 }, 7)).toBe(true)
      expect(isExpiringWithin({ ...live, daysRemaining: 30 }, 7)).toBe(false)
    })
    it('never includes an already-expired subscriber', () => {
      expect(isExpiringWithin({ ...live, daysRemaining: -2 }, 7)).toBe(false)
    })
  })
})
