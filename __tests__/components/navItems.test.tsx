import { NAV_ITEMS, navLabelFor, primaryNavItems } from '@/components/layout/navItems'

/*
 * One navigation, and it must be able to name every page.
 *
 * Two menus used to list different subsets of the app, and the header derived
 * the page title from the smaller one — so /today, /finance and /sales were all
 * labelled "لوحة التحكم". A header that names the wrong page is worse than a
 * header with no name: it quietly tells you that you are somewhere you are not.
 */

describe('NAV_ITEMS', () => {
  it('lists every destination exactly once', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('keeps each band contiguous, so the rail separators mean something', () => {
    // A group appearing, stopping and reappearing would draw a divider through
    // the middle of a band.
    const seen = new Set<string>()
    let prev = ''
    for (const item of NAV_ITEMS) {
      if (item.group !== prev) {
        expect(seen.has(item.group)).toBe(false)
        seen.add(item.group)
        prev = item.group
      }
    }
  })

  it('includes the two pages that had been unreachable', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(hrefs).toContain('/sales')
    expect(hrefs).toContain('/leaderboards')
  })

  it('gives every item a label and a group', () => {
    expect(NAV_ITEMS.every((i) => i.label.trim().length > 0 && i.group)).toBe(true)
  })
})

describe('navLabelFor', () => {
  it('names the dashboard only at the root', () => {
    expect(navLabelFor('/')).toBe('لوحة التحكم')
  })

  it('THE REGRESSION: names pages the old header could not', () => {
    expect(navLabelFor('/today')).toBe('مهام اليوم')
    expect(navLabelFor('/finance')).toBe('المالية')
    expect(navLabelFor('/sales')).toBe('المبيعات')
  })

  it('does not let "/" swallow every other path', () => {
    expect(navLabelFor('/subscribers')).toBe('المشتركون')
  })

  it('prefers the longest match, so a child page keeps its own name', () => {
    expect(navLabelFor('/whatsapp-leads')).toBe('واتساب ليدز')
    expect(navLabelFor('/whatsapp-leads/conversations')).toBe('المحادثات')
  })

  it('names a detail route by its section', () => {
    expect(navLabelFor('/subscribers/abc123')).toBe('المشتركون')
  })

  it('returns null for a path outside the menu rather than guessing', () => {
    expect(navLabelFor('/some-unknown-page')).toBeNull()
  })
})

/*
 * The shortcut row in the top bar.
 *
 * The row and the rail are allowed to show different AMOUNTS. They are not
 * allowed to disagree about what EXISTS — that disagreement is what made the app
 * feel scattered and what left every page outside the old six named
 * "لوحة التحكم". These tests pin the difference to a declared flag in one file.
 */
describe('primaryNavItems', () => {
  it('every shortcut is a real destination from the one menu', () => {
    const hrefs = new Set(NAV_ITEMS.map((i) => i.href))
    expect(primaryNavItems().every((i) => hrefs.has(i.href))).toBe(true)
  })

  it('is a short row, not a second copy of the whole menu', () => {
    expect(primaryNavItems()).toHaveLength(6)
    expect(primaryNavItems().length).toBeLessThan(NAV_ITEMS.length)
  })

  it('keeps menu order rather than inventing its own', () => {
    const order = NAV_ITEMS.filter((i) => i.primary).map((i) => i.href)
    expect(primaryNavItems().map((i) => i.href)).toEqual(order)
  })

  it('leads with the two screens a day starts from', () => {
    expect(primaryNavItems().slice(0, 2).map((i) => i.href)).toEqual(['/', '/today'])
  })

  it('THE INVARIANT: every shortcut can be named by the header', () => {
    // A link the header cannot label is the exact bug this file exists to stop.
    for (const item of primaryNavItems()) {
      expect(navLabelFor(item.href)).toBe(item.label)
    }
  })

  it('keeps reports and payment methods reachable on the rail', () => {
    // Dropped from the row, deliberately — not dropped from the app.
    const shortcuts = new Set(primaryNavItems().map((i) => i.href))
    expect(shortcuts.has('/reports')).toBe(false)
    expect(shortcuts.has('/payment-methods')).toBe(false)
    const all = NAV_ITEMS.map((i) => i.href)
    expect(all).toContain('/reports')
    expect(all).toContain('/payment-methods')
  })
})
