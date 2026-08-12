/**
 * @jest-environment node
 *
 * The two guards that stand between a payment and a ledger that no longer
 * describes the money.
 *
 * **Unallocated overflow.** A payment against a scheduled invoice must land on
 * an instalment. The subscriber-level guard in computePaymentUpdate() does not
 * cover this: it compares against `subscribers.totalPriceUSD`, which can
 * legitimately exceed the sum of open instalments after a waiver, a cancelled
 * instalment, or a price raised without extending the schedule. In those cases
 * the payment used to pass, the balance moved, no instalment changed, and the
 * surplus evaporated.
 *
 * **Write budget.** An invoice and its schedule are written in one transaction
 * so an invoice can never claim instalments that do not exist. Firestore caps a
 * transaction at 500 writes, and MAX_INSTALLMENTS is what keeps it under. That
 * coupling was implicit; assertWriteBudget makes it fail loudly at the point of
 * change instead of as an opaque rejection in production.
 */

jest.mock('firebase-admin/app', () => ({
  getApps: () => [{}], initializeApp: jest.fn(), cert: jest.fn(),
}))
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }))
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
  FieldValue: {
    serverTimestamp: () => 'ts',
    delete: () => 'del',
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...v: unknown[]) => ({ __arrayUnion: v }),
  },
  Timestamp: class {},
}))
jest.mock('@/lib/serverFirestore', () => ({
  hasAdminCredentials: () => true,
  fsGet: jest.fn(), fsSet: jest.fn(), fsPatch: jest.fn(), fsAdd: jest.fn(),
}))

import { stageInvoice, stageLedgerPayment, type OpenInvoice } from '@/lib/serverBillingLedger'
import { generateInstallmentSchedule, type AllocatableInstallment } from '@/lib/subscriberLifecycle'
import { MAX_INSTALLMENTS } from '@/constants/billing'

const TODAY = '2026-08-12'

/** A transaction double that records staged writes instead of performing them. */
function fakeTx() {
  const writes: { path: string; data: Record<string, unknown> }[] = []
  return {
    tx: {
      set: (ref: { path: string }, data: Record<string, unknown>) => writes.push({ path: ref.path, data }),
      update: (ref: { path: string }, data: Record<string, unknown>) => writes.push({ path: ref.path, data }),
      get: jest.fn(),
    },
    writes,
  }
}

/**
 * A Firestore double whose doc refs are addressable paths.
 *
 * `id` is not decoration: stageInvoice allocates the down payment by building a
 * map keyed on `ref.id`, so a ref without one collapses every key to `undefined`
 * and the last allocation appears to apply to every instalment. A double that
 * omits it produces a green test for broken behaviour.
 */
function fakeDb() {
  let n = 0
  return {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id ?? `auto${++n}`
        return { id: docId, path: `${name}/${docId}` }
      },
    }),
  }
}

function invoice(over: Partial<OpenInvoice> = {}): OpenInvoice {
  return {
    id: 'inv1', totalUSD: 150, paidUSD: 0, refundedUSD: 0,
    dueDate: '2026-12-01', cycleId: 'cyc1', cycleNumber: 1, ...over,
  }
}

function inst(over: Partial<AllocatableInstallment> & { id: string }): AllocatableInstallment {
  return { installmentNumber: 1, dueDate: '2026-09-01', amountUSD: 50, paidUSD: 0, status: 'pending', ...over }
}

const SCHEDULE: AllocatableInstallment[] = [
  inst({ id: 'a', installmentNumber: 1, dueDate: '2026-09-01' }),
  inst({ id: 'b', installmentNumber: 2, dueDate: '2026-10-01' }),
  inst({ id: 'c', installmentNumber: 3, dueDate: '2026-11-01' }),
]

function run(amountUSD: number, installments: AllocatableInstallment[], inv: OpenInvoice | null = invoice()) {
  const { tx, writes } = fakeTx()
  const result = stageLedgerPayment(
    tx as never,
    fakeDb() as never,
    { paymentId: 'p1', amountUSD, invoice: inv, installments, actorUid: 'u1', today: TODAY }
  )
  return { result, writes }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('unallocated overflow', () => {
  it('accepts a payment that fits the schedule', () => {
    const { result } = run(120, SCHEDULE)
    expect(result.unallocatedUSD).toBe(0)
    expect(result.allocations.map((a) => a.appliedUSD)).toEqual([50, 50, 20])
  })

  it('refuses money that lands on no instalment', () => {
    // 150 scheduled, 200 paid: 50 has nowhere to go.
    expect(() => run(200, SCHEDULE)).toThrow(/يتجاوز الأقساط المستحقة/)
  })

  it('names the surplus so the operator can correct the amount', () => {
    expect(() => run(200, SCHEDULE)).toThrow(/50\.00/)
  })

  it('gives a different message when every instalment is already settled', () => {
    const settled = SCHEDULE.map((i) => ({ ...i, paidUSD: i.amountUSD, status: 'paid' as const }))
    expect(() => run(10, settled)).toThrow(/لا يوجد قسط مفتوح/)
  })

  it('tolerates a sub-cent rounding remainder', () => {
    // Converting a local amount to USD routinely leaves a fraction; refusing
    // that would reject legitimate final payments.
    const { result } = run(150.005, SCHEDULE)
    expect(result.unallocatedUSD).toBeLessThanOrEqual(0.01)
  })

  it('leaves an unscheduled invoice alone — there is nothing to allocate to', () => {
    // paymentPlanType "full": the whole amount lands on the invoice by design.
    const { result } = run(500, [], invoice({ totalUSD: 500 }))
    expect(result.unallocatedUSD).toBe(500)
    expect(result.allocations).toEqual([])
  })

  it('is a no-op for a subscriber with no ledger at all', () => {
    const { result, writes } = run(100, [], null)
    expect(result.invoiceId).toBeNull()
    expect(writes).toHaveLength(0)
  })

  it('rolls the invoice and cycle forward when it does allocate', () => {
    const { writes } = run(150, SCHEDULE)
    const inv = writes.find((w) => w.path.startsWith('invoices/'))
    const cyc = writes.find((w) => w.path.startsWith('subscriptionCycles/'))
    expect(inv?.data).toMatchObject({ paidUSD: 150, remainingUSD: 0, status: 'paid' })
    expect(cyc?.data).toMatchObject({ paidAmountUSD: 150, remainingAmountUSD: 0 })
  })
})

describe('transaction write budget', () => {
  const base = {
    invoiceNumber: 'INV-2026-000001',
    subscriberId: 's1', subscriberName: 'س',
    cycleId: 'cyc1', cycleNumber: 1,
    issueDate: TODAY, dueDate: '2026-12-01',
    currencyOriginal: 'USD',
    subtotalOriginal: 600, discountOriginal: 0, totalOriginal: 600,
    exchangeRate: 1, totalUSD: 600, paidUSD: 0,
    planType: 'installments' as const,
    actorUid: 'u1', today: TODAY,
  }

  function schedule(count: number) {
    return generateInstallmentSchedule({
      totalOriginal: 600, exchangeRate: 1, count,
      firstDueDate: '2026-09-01', frequency: 'monthly',
    })
  }

  it('writes one document per instalment, plus the invoice and the cycle link', () => {
    const { tx, writes } = fakeTx()
    stageInvoice(tx as never, fakeDb() as never, { ...base, schedule: schedule(12) })
    expect(writes.filter((w) => w.path.startsWith('installments/'))).toHaveLength(12)
    expect(writes.filter((w) => w.path.startsWith('invoices/'))).toHaveLength(1)
  })

  it('accepts a schedule exactly at the cap', () => {
    const { tx } = fakeTx()
    expect(() =>
      stageInvoice(tx as never, fakeDb() as never, { ...base, schedule: schedule(MAX_INSTALLMENTS) })
    ).not.toThrow()
  })

  it('refuses one past the cap rather than letting Firestore reject the transaction', () => {
    const { tx } = fakeTx()
    const oversized = Array.from({ length: MAX_INSTALLMENTS + 1 }, (_, i) => ({
      installmentNumber: i + 1, dueDate: '2026-09-01', amountOriginal: 10, amountUSD: 10,
    }))
    expect(() =>
      stageInvoice(tx as never, fakeDb() as never, { ...base, schedule: oversized })
    ).toThrow(/يتجاوز الحد المسموح/)
  })

  it('keeps the cap far enough below the Firestore limit to be safe', () => {
    expect(MAX_INSTALLMENTS).toBeLessThan(500 - 12)
  })

  it('applies a down payment to the schedule instead of leaving it floating', () => {
    const { tx, writes } = fakeTx()
    stageInvoice(tx as never, fakeDb() as never, {
      ...base, paidUSD: 200, schedule: schedule(6), // 6 × 100
    })
    const installments = writes.filter((w) => w.path.startsWith('installments/'))
    expect(installments[0].data).toMatchObject({ paidUSD: 100, status: 'paid' })
    expect(installments[1].data).toMatchObject({ paidUSD: 100, status: 'paid' })
    expect(installments[2].data).toMatchObject({ paidUSD: 0 })
  })

  it('marks an unscheduled invoice paid when it was settled up front', () => {
    const { tx, writes } = fakeTx()
    stageInvoice(tx as never, fakeDb() as never, {
      ...base, planType: 'full', paidUSD: 600, schedule: [],
    })
    const inv = writes.find((w) => w.path.startsWith('invoices/'))
    expect(inv?.data).toMatchObject({ status: 'paid', remainingUSD: 0, installmentCount: 0 })
  })
})
