import {
  buildTodayTasks,
  whatsappNumber,
  RENEWAL_HORIZON_DAYS,
  WIN_BACK_WINDOW_DAYS,
} from '@/lib/todayTasks'

/*
 * The day's work list.
 *
 * The rules that matter are the exclusions: a withdrawn subscriber is nobody's
 * task, a subscriber who expired four months ago is not today's problem, and a
 * paused subscriber should not appear as a renewal call while still appearing
 * as a debt. Getting those wrong does not crash anything — it produces a list
 * people stop trusting, which is worse than no list.
 */

const sub = (over: Partial<Parameters<typeof buildTodayTasks>[0][number]> = {}) => ({
  id: 's', name: 'مشترك', subscriptionState: 'active', daysRemaining: 90, ...over,
})

describe('buildTodayTasks', () => {
  describe('renewals', () => {
    it('includes someone expiring inside the horizon', () => {
      const t = buildTodayTasks([sub({ id: 'a', daysRemaining: 3 })])
      expect(t.renewals.map((r) => r.subscriber.id)).toEqual(['a'])
    })

    it('excludes someone comfortably far from expiry', () => {
      expect(buildTodayTasks([sub({ daysRemaining: RENEWAL_HORIZON_DAYS + 1 })]).renewals).toHaveLength(0)
    })

    it('includes the day of expiry itself', () => {
      expect(buildTodayTasks([sub({ daysRemaining: 0 })]).renewals).toHaveLength(1)
    })

    it('excludes an already-expired subscriber — that is a win-back, not a renewal', () => {
      expect(buildTodayTasks([sub({ daysRemaining: -1 })]).renewals).toHaveLength(0)
    })

    it('excludes paused and withdrawn subscribers', () => {
      expect(buildTodayTasks([sub({ daysRemaining: 2, subscriptionStatus: 'paused' })]).renewals).toHaveLength(0)
      expect(buildTodayTasks([sub({ daysRemaining: 2, subscriptionState: 'withdrawn' })]).renewals).toHaveLength(0)
    })

    it('puts the most urgent first', () => {
      const t = buildTodayTasks([
        sub({ id: 'later', daysRemaining: 6 }),
        sub({ id: 'today', daysRemaining: 0 }),
        sub({ id: 'tomorrow', daysRemaining: 1 }),
      ])
      expect(t.renewals.map((r) => r.subscriber.id)).toEqual(['today', 'tomorrow', 'later'])
    })

    it('says plainly when it expires', () => {
      const t = buildTodayTasks([sub({ daysRemaining: 1 })])
      expect(t.renewals[0].reason).toBe('ينتهي غداً')
    })
  })

  describe('win-back', () => {
    it('includes someone who expired recently', () => {
      expect(buildTodayTasks([sub({ daysRemaining: -5 })]).winBack).toHaveLength(1)
    })

    it('excludes someone who expired long ago — a task list is not a graveyard', () => {
      expect(buildTodayTasks([sub({ daysRemaining: -(WIN_BACK_WINDOW_DAYS + 1) })]).winBack).toHaveLength(0)
    })

    it('excludes the withdrawn — they chose to leave', () => {
      expect(buildTodayTasks([sub({ daysRemaining: -3, subscriptionState: 'withdrawn' })]).winBack).toHaveLength(0)
    })

    it('puts the most recently lapsed first, while the memory is fresh', () => {
      const t = buildTodayTasks([sub({ id: 'old', daysRemaining: -20 }), sub({ id: 'fresh', daysRemaining: -2 })])
      expect(t.winBack.map((r) => r.subscriber.id)).toEqual(['fresh', 'old'])
    })
  })

  describe('collections', () => {
    it('lists anyone still owing, largest balance first', () => {
      const t = buildTodayTasks([
        sub({ id: 'small', remainingAmountUSD: 5 }),
        sub({ id: 'big', remainingAmountUSD: 200 }),
        sub({ id: 'clear', remainingAmountUSD: 0 }),
      ])
      expect(t.collections.map((r) => r.subscriber.id)).toEqual(['big', 'small'])
    })

    it('still chases a paused subscriber — a hold is not a discount', () => {
      const t = buildTodayTasks([sub({ subscriptionStatus: 'paused', remainingAmountUSD: 50 })])
      expect(t.collections).toHaveLength(1)
    })

    it('does not chase the withdrawn', () => {
      expect(buildTodayTasks([sub({ subscriptionState: 'withdrawn', remainingAmountUSD: 50 })]).collections).toHaveLength(0)
    })

    it('formats a whole-dollar balance without stray decimals', () => {
      expect(buildTodayTasks([sub({ remainingAmountUSD: 40 })]).collections[0].reason).toBe('متبقٍّ $40')
    })
  })

  it('one subscriber can be two tasks at once, and is counted as both', () => {
    // Expiring in two days AND owing money is one person and two jobs.
    const t = buildTodayTasks([sub({ id: 'x', daysRemaining: 2, remainingAmountUSD: 30 })])
    expect(t.renewals).toHaveLength(1)
    expect(t.collections).toHaveLength(1)
    expect(t.total).toBe(2)
  })

  it('returns empty lists rather than throwing on an empty book', () => {
    expect(buildTodayTasks([])).toEqual({ renewals: [], winBack: [], collections: [], total: 0 })
  })
})

describe('whatsappNumber', () => {
  it('joins the dial code and strips punctuation', () => {
    expect(whatsappNumber({ id: 's', name: 'x', dialCode: '+970', phone: '567 176 354' })).toBe('970567176354')
  })

  it('returns null for an unusable number instead of a broken link', () => {
    expect(whatsappNumber({ id: 's', name: 'x', phone: '123' })).toBeNull()
    expect(whatsappNumber({ id: 's', name: 'x' })).toBeNull()
  })
})

/*
 * Follow-up outcomes change the list.
 *
 * The failure this guards against is quiet: a list that hides everyone who
 * answered the phone looks like progress and loses the customer, while a list
 * that never changes makes the team stop marking anything at all.
 */
describe('follow-up outcomes', () => {
  const due = { id: 'x', name: 'م', subscriptionState: 'active', daysRemaining: 3 }
  const lapsed = { id: 'y', name: 'ن', subscriptionState: 'active', daysRemaining: -5 }

  it('drops a renewed subscriber from renewals — the work is done', () => {
    expect(buildTodayTasks([{ ...due, renewalWorkflowStatus: 'renewed' }]).renewals).toHaveLength(0)
  })

  it('drops a declined subscriber from win-back', () => {
    expect(buildTodayTasks([{ ...lapsed, renewalWorkflowStatus: 'declined' }]).winBack).toHaveLength(0)
  })

  it('KEEPS a contacted subscriber — answering the phone is not paying', () => {
    const t = buildTodayTasks([{ ...due, renewalWorkflowStatus: 'contacted' }])
    expect(t.renewals).toHaveLength(1)
    expect(t.renewals[0].inProgress).toBe(true)
  })

  it('keeps a promised subscriber too — a promise is not a payment', () => {
    expect(buildTodayTasks([{ ...due, renewalWorkflowStatus: 'promised' }]).renewals).toHaveLength(1)
  })

  it('sinks in-progress rows below untouched ones, however urgent they are', () => {
    const t = buildTodayTasks([
      { ...due, id: 'spoken-today', daysRemaining: 0, renewalWorkflowStatus: 'contacted' },
      { ...due, id: 'untouched', daysRemaining: 6 },
    ])
    expect(t.renewals.map((r) => r.subscriber.id)).toEqual(['untouched', 'spoken-today'])
  })

  it('still chases the money after a renewal outcome — they are separate debts', () => {
    const t = buildTodayTasks([{ ...due, renewalWorkflowStatus: 'renewed', remainingAmountUSD: 60 }])
    expect(t.renewals).toHaveLength(0)
    expect(t.collections).toHaveLength(1)
  })

  it('treats an unknown or missing status as untouched', () => {
    expect(buildTodayTasks([{ ...due, renewalWorkflowStatus: 'pending' }]).renewals[0].inProgress).toBe(false)
    expect(buildTodayTasks([due]).renewals[0].inProgress).toBe(false)
  })
})
