import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  applyPeriodAction,
  backdatedRefusal,
  canWriteMoneyIn,
  closedPeriodsInSpan,
  isClosed,
  periodOf,
  periodsSpanned,
  refusePeriodAction,
  restatementRefusal,
  type FinancialPeriod,
} from '@/lib/financialPeriod'
import { SUBSCRIBER_FIELD_POLICY, CREATE_WRITABLE_SUBSCRIBER_FIELDS } from '@/constants/subscriberFieldPolicy'

/**
 * A month you can stop changing, and an acquisition date that stops moving.
 *
 * Two things were true before this: a payment recorded in September and dated to
 * May silently moved May's totals, and nothing in the system held the date a
 * customer was won — `date` and `startDate` both mean "start of the current
 * cycle" and renewal overwrites both.
 *
 * The stored monthly aggregate that was supposed to answer the first is gone. It
 * was a second copy of a number the payments already held, it had drifted from
 * them, and no screen read it. These tests hold the door shut behind it.
 */

const TODAY = '2026-09-06'
const REASON = 'إقفال شهري بعد مراجعة الحسابات'

const closedMay: FinancialPeriod = {
  period: '2026-05',
  status: 'closed',
  closedAt: '2026-06-02T00:00:00.000Z',
  closedBy: 'owner-1',
  closeReason: REASON,
  events: [{ action: 'closed', at: '2026-06-02T00:00:00.000Z', by: 'owner-1', reason: REASON }],
}

describe('a month with no document is open', () => {
  it('treats an absent period as writable', () => {
    // Months are not created in advance. An absent record reading as locked
    // would freeze the system the day it shipped.
    expect(canWriteMoneyIn(null)).toBe(true)
    expect(isClosed(null)).toBe(false)
  })

  it('reads the period from the document own date', () => {
    expect(periodOf('2026-05-31')).toBe('2026-05')
    expect(periodOf('')).toBeNull()
    expect(periodOf('2026-13-01')).toBeNull()
  })
})

describe('who may close and reopen', () => {
  it('lets an owner close a finished month', () => {
    expect(refusePeriodAction('close', '2026-05', REASON, null, 'owner', TODAY)).toEqual([])
  })

  it('refuses an admin', () => {
    const r = refusePeriodAction('close', '2026-05', REASON, null, 'admin', TODAY)
    expect(r.map((x) => x.field)).toContain('role')
  })

  it('refuses an employee', () => {
    const r = refusePeriodAction('close', '2026-05', REASON, null, 'employee', TODAY)
    expect(r.map((x) => x.field)).toContain('role')
  })

  it('refuses a reopen by anyone but the owner', () => {
    for (const role of ['admin', 'employee']) {
      const r = refusePeriodAction('reopen', '2026-05', 'خطأ مكتشف في مراجعة لاحقة', closedMay, role, TODAY)
      expect(r.map((x) => x.field)).toContain('role')
    }
  })

  it('lets the owner reopen with a reason', () => {
    expect(
      refusePeriodAction('reopen', '2026-05', 'خطأ في سعر اشتراك اكتُشف في سبتمبر', closedMay, 'owner', TODAY)
    ).toEqual([])
  })

  it('refuses a reopen with no reason', () => {
    const r = refusePeriodAction('reopen', '2026-05', 'خطأ', closedMay, 'owner', TODAY)
    expect(r.map((x) => x.field)).toContain('reason')
  })

  it('refuses closing a month that has not ended', () => {
    // Money can still land in the month you are standing in.
    const r = refusePeriodAction('close', '2026-09', REASON, null, 'owner', TODAY)
    expect(r.map((x) => x.field)).toContain('period')
  })

  it('refuses closing what is already closed, and reopening what is open', () => {
    expect(refusePeriodAction('close', '2026-05', REASON, closedMay, 'owner', TODAY).map((x) => x.field))
      .toContain('status')
    expect(refusePeriodAction('reopen', '2026-05', REASON, null, 'owner', TODAY).map((x) => x.field))
      .toContain('status')
  })
})

describe('history is appended, never overwritten', () => {
  it('keeps every close and reopen in order', () => {
    const closed = applyPeriodAction('close', '2026-05', 'إقفال أول', null, { uid: 'o1' }, 't1')
    const reopened = applyPeriodAction('reopen', '2026-05', 'تصحيح سعر', closed, { uid: 'o1' }, 't2')
    const reclosed = applyPeriodAction('close', '2026-05', 'إقفال بعد التصحيح', reopened, { uid: 'o1' }, 't3')

    expect(reclosed.events.map((e) => e.action)).toEqual(['closed', 'reopened', 'closed'])
    expect(reclosed.events.map((e) => e.reason)).toEqual(['إقفال أول', 'تصحيح سعر', 'إقفال بعد التصحيح'])
    // A second reopen must not erase the first one's timestamp.
    const reopenedAgain = applyPeriodAction('reopen', '2026-05', 'خطأ آخر', reclosed, { uid: 'o1' }, 't4')
    expect(reopenedAgain.events).toHaveLength(4)
  })

  it('keeps the snapshot through a reopen', () => {
    // The snapshot is the record of what was reported. Deleting it on reopen
    // would erase the very thing being corrected.
    const snap = { cashUSD: 900, refundsUSD: 0, recognizedRevenueUSD: 500, deferredRevenueUSD: 400, takenAt: 't1' }
    const closed = applyPeriodAction('close', '2026-05', REASON, null, { uid: 'o1' }, 't1', snap)
    const reopened = applyPeriodAction('reopen', '2026-05', 'تصحيح', closed, { uid: 'o1' }, 't2')
    expect(reopened.snapshot).toEqual(snap)
    expect(reopened.status).toBe('open')
  })

  it('retakes the snapshot on a later close', () => {
    const first = { cashUSD: 900, refundsUSD: 0, recognizedRevenueUSD: 500, deferredRevenueUSD: 400, takenAt: 't1' }
    const second = { cashUSD: 900, refundsUSD: 0, recognizedRevenueUSD: 50, deferredRevenueUSD: 850, takenAt: 't3' }
    const closed = applyPeriodAction('close', '2026-05', REASON, null, { uid: 'o1' }, 't1', first)
    const reopened = applyPeriodAction('reopen', '2026-05', 'تصحيح', closed, { uid: 'o1' }, 't2')
    const reclosed = applyPeriodAction('close', '2026-05', 'إقفال بعد التصحيح', reopened, { uid: 'o1' }, 't3', second)
    expect(reclosed.snapshot).toEqual(second)
  })
})

describe('backdated money', () => {
  it('refuses a payment dated into a closed month', () => {
    expect(canWriteMoneyIn(closedMay)).toBe(false)
    expect(backdatedRefusal('2026-05', 'payment')).toContain('مغلقة')
  })

  it('refuses a refund the same way', () => {
    expect(backdatedRefusal('2026-05', 'refund')).toContain('استرداد')
  })

  it('never offers to move the date to the open month', () => {
    // Shifting the date would hide when the money actually happened.
    const msg = backdatedRefusal('2026-05', 'payment')
    expect(msg).toContain('لا يُحوَّل تلقائياً')
    expect(msg).toContain('تسوية')
  })
})

describe('a correction that would restate a closed month', () => {
  it('lists every month a service span touches', () => {
    expect(periodsSpanned('2026-05-15', 90)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08'])
    expect(periodsSpanned('2026-05-01', 30)).toEqual(['2026-05'])
  })

  it('refuses when any month in the span is closed', () => {
    // Recognition is straight-line across the whole span, so a price change
    // moves every month it touches — not just the month of the correction.
    const closed = new Set(['2026-05'])
    expect(closedPeriodsInSpan('2026-05-15', 90, closed)).toEqual(['2026-05'])
    expect(restatementRefusal(['2026-05'])).toContain('أعد فتح الفترة')
  })

  it('allows a correction whose whole span is open', () => {
    expect(closedPeriodsInSpan('2026-09-01', 30, new Set(['2026-05']))).toEqual([])
  })
})

describe('firstSubscribedAt', () => {
  it('is server-owned, so no form and no renewal payload can move it', () => {
    expect(SUBSCRIBER_FIELD_POLICY.firstSubscribedAt).toBe('server')
    expect(CREATE_WRITABLE_SUBSCRIBER_FIELDS.has('firstSubscribedAt')).toBe(false)
  })

  it('is written by createSubscriber and never by renewSubscription', () => {
    /*
     * Read from the route source rather than mocked: the rule is "renewal does
     * not touch this field", and the only way that can be false is a line
     * appearing in that function. A mock would test the mock.
     */
    const src = readFileSync(join(process.cwd(), 'app/api/subscriber-operations/route.ts'), 'utf8')
    const create = src.slice(src.indexOf('async function createSubscriber'), src.indexOf('async function updateSubscriber'))
    const renew = src.slice(src.indexOf('async function renewSubscription'), src.indexOf('async function withdrawSubscriber'))

    expect(create).toContain('firstSubscribedAt:')
    // Present only inside a comment explaining its absence.
    const renewCode = renew.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    expect(renewCode.join('\n')).not.toContain('firstSubscribedAt:')
  })
})

describe('monthlyAnalytics is gone and stays gone', () => {
  const ROOT = process.cwd()
  const SKIP = new Set(['node_modules', '.next', '.git', 'out', 'coverage', 'lib'])

  function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        // functions/lib is build output; functions/src is the source that matters.
        if (entry === 'lib' && full.includes('functions')) continue
        walk(full, acc)
      } else if (/\.(ts|tsx|mjs|rules)$/.test(entry)) {
        acc.push(full)
      }
    }
    return acc
  }

  const files = walk(ROOT).filter((f) => !f.includes('__tests__'))

  it('has no reader or writer left anywhere in the source', () => {
    const hits = files.filter((f) => {
      const body = readFileSync(f, 'utf8')
      // The rules file mentions it only in the comment recording the removal.
      if (f.endsWith('.rules')) return /match \/monthlyAnalytics/.test(body)
      return /collection\((?:db,\s*)?["'`]monthlyAnalytics|useMonthlyAnalytics|MONTHLY_ANALYTICS/.test(body)
    })
    expect(hits).toEqual([])
  })

  it('has no scheduled or callable analytics function left', () => {
    const hits = files.filter((f) =>
      /computeMonthlyAnalyticsScheduled|recomputeMonthlyAnalytics/.test(readFileSync(f, 'utf8'))
    )
    expect(hits).toEqual([])
  })

  it('deleted the analytics function source outright', () => {
    expect(existsSync(join(ROOT, 'functions/src/analytics.ts'))).toBe(false)
  })

  it('leaves no writer that can create a dotted field name', () => {
    /*
     * The bug: `set(delta, {merge:true})` with keys like
     * `byEmployee.<uid>.totalPaymentsUSD`. `set` stores a dotted key literally
     * as a field name; only `update` reads it as a path. Production still holds
     * a field actually called "byEmployee.aP7B…totalPaymentsUSD" because of it.
     */
    const offenders = files.filter((f) => {
      const body = readFileSync(f, 'utf8')
      return /\[`[A-Za-z]+\.\$\{/.test(body) && /\.set\(/.test(body)
    })
    expect(offenders).toEqual([])
  })
})
