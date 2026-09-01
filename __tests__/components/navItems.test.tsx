import { NAV_ITEMS, navLabelFor } from '@/components/layout/navItems'

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
