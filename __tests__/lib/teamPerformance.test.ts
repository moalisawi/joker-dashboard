import { teamPerformanceFromSubscribers } from '@/lib/analytics/calculations'
import type { Subscriber } from '@/types'
import type { Team } from '@/types'

/*
 * Team credit.
 *
 * The third instance of the same pattern found in this project: a metric keyed
 * on a field belonging to the newer workflow extension, which no record here
 * carries. `assignedTeamId` is set on 0 of 51 subscribers while the legacy
 * `team` name is set on all 51 — so every team scored zero, on every period,
 * for as long as the leaderboard has existed.
 *
 * Zero is a legal answer, so nothing threw and no test noticed.
 */

const team = (id: string, name: string) => ({ id, name }) as Team
const sub = (over: Partial<Subscriber>) => ({ id: 's', name: 'م', ...over }) as Subscriber

const TEAMS = [team('t-youth', 'فريق الشباب'), team('t-girls', 'فريق البنات')]

describe('teamPerformanceFromSubscribers', () => {
  it('THE REGRESSION: credits by team name when no id is assigned', () => {
    const rows = [
      sub({ team: 'فريق الشباب', netAmountUSD: 100 }),
      sub({ team: 'فريق الشباب', netAmountUSD: 50 }),
      sub({ team: 'فريق البنات', netAmountUSD: 25 }),
    ]
    const byId = Object.fromEntries(teamPerformanceFromSubscribers(rows, TEAMS).map((m) => [m.teamId, m]))
    expect(byId['t-youth'].subscribers).toBe(2)
    expect(byId['t-youth'].revenue).toBe(150)
    expect(byId['t-girls'].subscribers).toBe(1)
  })

  it('still credits by assignedTeamId when one is set', () => {
    const rows = [sub({ assignedTeamId: 't-girls', netAmountUSD: 40 })]
    const byId = Object.fromEntries(teamPerformanceFromSubscribers(rows, TEAMS).map((m) => [m.teamId, m]))
    expect(byId['t-girls'].subscribers).toBe(1)
  })

  it('lets an explicit assignment override the legacy name', () => {
    // Moved between teams: the id is the newer, deliberate statement.
    const rows = [sub({ team: 'فريق الشباب', assignedTeamId: 't-girls' })]
    const byId = Object.fromEntries(teamPerformanceFromSubscribers(rows, TEAMS).map((m) => [m.teamId, m]))
    expect(byId['t-girls'].subscribers).toBe(1)
    expect(byId['t-youth'].subscribers).toBe(0)
  })

  it('never double-counts: name and id resolve to the same bucket', () => {
    const rows = [sub({ team: 'فريق الشباب' }), sub({ assignedTeamId: 't-youth' })]
    const rows2 = teamPerformanceFromSubscribers(rows, TEAMS)
    expect(rows2.filter((m) => m.teamId === 't-youth')).toHaveLength(1)
    expect(rows2.find((m) => m.teamId === 't-youth')!.subscribers).toBe(2)
  })

  it('keeps a team with no subscribers in the list rather than hiding it', () => {
    const out = teamPerformanceFromSubscribers([], TEAMS)
    expect(out).toHaveLength(2)
    expect(out.every((m) => m.subscribers === 0)).toBe(true)
  })

  it('ignores a subscriber whose team name matches nothing', () => {
    // Better an uncounted row than an invented team on a leaderboard.
    const rows = [sub({ team: 'فريق غير موجود' })]
    const out = teamPerformanceFromSubscribers(rows, TEAMS)
    expect(out.reduce((n, m) => n + m.subscribers, 0)).toBe(0)
  })
})
