import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { monthlyAcquisitionTrend } from '@/lib/analytics/calculations'
import { refuseCorrection, CORRECTABLE_TERMS, type CycleTermsState } from '@/lib/cycleTermsCorrection'
import { findImmutableViolations } from '@/lib/subscriberWriteGuard'
import {
  CREATE_WRITABLE_SUBSCRIBER_FIELDS,
  UPDATE_WRITABLE_SUBSCRIBER_FIELDS,
  SUBSCRIBER_FIELD_POLICY,
} from '@/constants/subscriberFieldPolicy'
import { normalizeSubscriber } from '@/lib/utils'
import type { Subscriber } from '@/types'

/**
 * Three fields, three meanings, and one of them used to be missing entirely.
 *
 *   startDate          start of the CURRENT service cycle
 *   date               legacy alias of the same thing — renewal overwrites it
 *   firstSubscribedAt  when the customer was won, and never moved again
 *
 * Six screens read `date` as an acquisition date. It is not one:
 * `renewSubscription` writes `date: startDate`, so the first renewal would have
 * moved a customer out of the month that won them and into the month they
 * renewed in — silently, with every chart agreeing on the wrong answer.
 *
 * Zero renewals exist in the data, so the bug was written and had not yet
 * fired. These tests make sure it cannot.
 */

function sub(over: Partial<Subscriber>): Subscriber {
  return normalizeSubscriber({ id: 'x', ...over } as Record<string, unknown> & { id: string })
}

describe('acquisition is not the current cycle', () => {
  it('buckets a renewed customer by the month they were won', () => {
    const now = new Date()
    const ym = (back: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
      return d.toISOString().slice(0, 7)
    }
    // Won two months ago, renewed this month: `date` says now, the truth says then.
    const renewed = sub({
      firstSubscribedAt: `${ym(2)}-10`,
      date: `${ym(0)}-03`,
      startDate: `${ym(0)}-03`,
      paidAmountUSD: 100,
    })

    const rows = monthlyAcquisitionTrend([renewed], 4)
    const wonMonth = rows.find((r) => r.month === ym(2))
    const renewalMonth = rows.find((r) => r.month === ym(0))

    expect(wonMonth?.subscribers).toBe(1)
    expect(renewalMonth?.subscribers).toBe(0)
  })

  it('falls back to date for records written before the field existed', () => {
    // 21 of the 51 demo subscribers have no startDate and none has
    // firstSubscribedAt. For a first cycle the two coincide, so the fallback is
    // exact rather than approximate — and no migration is needed to read them.
    const legacy = sub({ date: '2026-05-10' })
    expect(legacy.firstSubscribedAt).toBe('2026-05-10')
  })
})

describe('firstSubscribedAt cannot be supplied or moved by a client', () => {
  it('is server-owned on both write paths', () => {
    expect(SUBSCRIBER_FIELD_POLICY.firstSubscribedAt).toBe('server')
    expect(CREATE_WRITABLE_SUBSCRIBER_FIELDS.has('firstSubscribedAt')).toBe(false)
    expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has('firstSubscribedAt')).toBe(false)
  })

  it('is not a term correctCycleTerms may touch', () => {
    expect([...CORRECTABLE_TERMS]).not.toContain('firstSubscribedAt')

    const state: CycleTermsState = {
      totalPriceOriginal: 100, currencyOriginal: 'USD', lockedRate: 1, duration: 30,
      package: 'فضية', startDate: '2026-09-06',
      paidAmountUSD: 0, refundAmountUSD: 0,
      paymentCount: 0, refundCount: 0, installmentCount: 0,
      subscriptionState: 'active', subscriptionStatus: 'active',
    }
    const refusals = refuseCorrection(
      { firstSubscribedAt: '2020-01-01' } as never,
      state,
      'محاولة تغيير تاريخ الاكتساب عبر التصحيح'
    )
    expect(refusals.map((r) => r.message).join(' ')).toContain('لا يمكن تصحيح')
  })

  it('is not one of the sale terms the generic update guard reports on', () => {
    // It is blocked one layer earlier — by the allow-list, not by the
    // immutable-terms check — so this records which layer owns it.
    expect(findImmutableViolations({ firstSubscribedAt: '2020-01-01' }, { firstSubscribedAt: '2026-09-06' })).toEqual([])
    expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has('firstSubscribedAt')).toBe(false)
  })
})

describe('no acquisition reader is left on the raw date field', () => {
  const ACQUISITION_FILES = [
    'lib/analytics/calculations.ts',
    'components/stats/SmartInsights.tsx',
    'components/stats/SubscriptionChart.tsx',
    'components/dashboard/DashboardHero.tsx',
    'components/dashboard/ActivityTimeline.tsx',
    'components/stats/TodaySummary.tsx',
    'components/stats/AdvancedStats.tsx',
    'app/analytics/page.tsx',
  ]

  it.each(ACQUISITION_FILES)('%s reads firstSubscribedAt', (file) => {
    const body = readFileSync(join(process.cwd(), file), 'utf8')
    expect(body).toContain('firstSubscribedAt')
  })

  it('leaves service-window logic on startDate, where it belongs', () => {
    // The mirror of the rule above: recognition spreads revenue across the
    // CURRENT cycle, so it must not be moved onto the acquisition date.
    const recognition = readFileSync(join(process.cwd(), 'lib/revenueRecognition.ts'), 'utf8')
    expect(recognition).toContain('s.startDate ?? s.date')
    expect(recognition).not.toContain('firstSubscribedAt')
  })
})
