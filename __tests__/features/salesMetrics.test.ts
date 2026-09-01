import { filterEmployeeSubscribers } from '@/features/sales/lib/salesMetrics'
import type { Subscriber } from '@/types'

/*
 * Sales credit.
 *
 * This filter matched only `assignedSalesId`, a field set on NO subscriber in
 * this installation, while `convincedByUid` is set on all 51. Every employee
 * therefore scored zero subscribers and $0 revenue, and the page was dropped
 * from the navigation rather than fixed — a broken screen made invisible instead
 * of repaired, which is the worst of both.
 *
 * The failure was silent by construction: zeros are a legal answer, so nothing
 * errored and no test noticed.
 */

const sub = (over: Partial<Subscriber>) => ({ id: 's', name: 'م', ...over }) as Subscriber

describe('filterEmployeeSubscribers', () => {
  it('credits by convincedByUid — the field this installation actually populates', () => {
    const rows = [sub({ id: 'a', convincedByUid: 'emp-1' }), sub({ id: 'b', convincedByUid: 'emp-2' })]
    expect(filterEmployeeSubscribers(rows, 'emp-1').map((s) => s.id)).toEqual(['a'])
  })

  it('still credits by assignedSalesId when one is set', () => {
    const rows = [sub({ id: 'a', assignedSalesId: 'emp-1' })]
    expect(filterEmployeeSubscribers(rows, 'emp-1').map((s) => s.id)).toEqual(['a'])
  })

  it('lets an explicit assignment override who signed them up', () => {
    // Handed to another rep: the assignment is the newer, deliberate statement.
    const rows = [sub({ id: 'a', convincedByUid: 'emp-1', assignedSalesId: 'emp-2' })]
    expect(filterEmployeeSubscribers(rows, 'emp-2').map((s) => s.id)).toEqual(['a'])
    expect(filterEmployeeSubscribers(rows, 'emp-1')).toHaveLength(0)
  })

  it('credits nobody for a subscriber carrying neither field', () => {
    expect(filterEmployeeSubscribers([sub({ id: 'a' })], 'emp-1')).toHaveLength(0)
  })

  it('THE REGRESSION: a book with no assignedSalesId no longer scores zero', () => {
    // Exactly the production shape — 0 of 51 assigned, all 51 convinced-by.
    const book = Array.from({ length: 5 }, (_, i) => sub({ id: `s${i}`, convincedByUid: 'emp-1' }))
    expect(filterEmployeeSubscribers(book, 'emp-1')).toHaveLength(5)
  })
})
