import {
  matchesCustomer,
  normalizeName,
  phoneCandidates,
  searchCustomers,
  toDigits,
} from '@/lib/customerSearch'

/**
 * The global search box did not search.
 *
 * cmdk was mounted with its own filtering disabled and nothing replaced it, so
 * every keystroke returned the same first fifty subscribers — including a query
 * matching nobody. The fifty was cut before any matching, so the fifty-first
 * subscriber was unreachable by any string at all.
 *
 * The tests below are the eight search cases from the brief, plus the two that
 * matter most in practice: a query that must return nothing, and two people
 * sharing a number who must both be shown rather than one silently chosen.
 */

const book = [
  { id: '1', name: 'أحمد محمد شاهين', dialCode: '+970', phone: '599123456', residence: 'فلسطين-غزة', package: 'ذهبية', team: 'فريق الشباب' },
  { id: '2', name: 'حسام عماد دياب',  dialCode: '+20',  phone: '01012345678', residence: 'EG', package: 'فضية', team: 'فريق المبيعات' },
  { id: '3', name: 'رهف صبحي شاهين',  dialCode: '+962', phone: '791112222', residence: 'JO', package: 'فضية', team: 'فريق البنات' },
  // Same number as #1 — a couple, or a parent paying for a child.
  { id: '4', name: 'سارة أحمد شاهين', dialCode: '+970', phone: '599123456', residence: 'فلسطين-غزة', package: 'ذهبية', team: 'فريق البنات' },
]

describe('digit normalisation', () => {
  it('strips every separator a number is typed with', () => {
    expect(toDigits('+970 59-912 (3456)')).toBe('970599123456')
  })

  it('reads Arabic-Indic digits as the same number', () => {
    // A phone typed on an Arabic keyboard is the same phone.
    expect(toDigits('٠٥٩٩١٢٣٤٥٦')).toBe('0599123456')
  })
})

describe('name normalisation', () => {
  it('folds alef forms so احمد finds أحمد', () => {
    expect(normalizeName('أحمد')).toBe(normalizeName('احمد'))
  })

  it('folds teh marbuta and alef maqsura', () => {
    expect(normalizeName('سارة')).toBe(normalizeName('ساره'))
    expect(normalizeName('مصطفى')).toBe(normalizeName('مصطفي'))
  })

  it('drops diacritics', () => {
    expect(normalizeName('مُحَمَّد')).toBe(normalizeName('محمد'))
  })
})

describe('phone forms', () => {
  it('offers the national and international forms of one number', () => {
    const forms = phoneCandidates({ dialCode: '+970', phone: '0599123456' })
    expect(forms).toContain('0599123456')
    expect(forms).toContain('970599123456')
  })
})

describe('search', () => {
  // TEST 2 — by name
  it('finds by name', () => {
    expect(searchCustomers(book, 'حسام').map((r) => r.id)).toEqual(['2'])
  })

  it('finds by name typed without hamza', () => {
    expect(searchCustomers(book, 'احمد').map((r) => r.id)).toEqual(['1', '4'])
  })

  // TEST 3 — local form, with the trunk zero
  it('finds by the local number', () => {
    expect(searchCustomers(book, '0599123456').map((r) => r.id)).toEqual(['1', '4'])
  })

  // TEST 4 — international with +
  it('finds by the international number with a plus', () => {
    expect(searchCustomers(book, '+970599123456').map((r) => r.id)).toEqual(['1', '4'])
  })

  // TEST 5 — international without +
  it('finds by the international number without a plus', () => {
    expect(searchCustomers(book, '970599123456').map((r) => r.id)).toEqual(['1', '4'])
  })

  // TEST 6 — formatting
  it('ignores spaces, hyphens and parentheses', () => {
    expect(searchCustomers(book, '+970 599-123 (456)').map((r) => r.id)).toEqual(['1', '4'])
    expect(searchCustomers(book, '059 912 3456').map((r) => r.id)).toEqual(['1', '4'])
  })

  it('finds by a trailing fragment of the number', () => {
    // What someone reads off the end of a WhatsApp notification.
    //
    // A fragment is deliberately allowed to hit more than one person: '123456'
    // is also inside 01012345678. Narrowing it to a suffix-only match would
    // make the fragment useless for numbers stored in the other form, and
    // showing an extra row costs a glance — silently picking one costs a call
    // to the wrong customer.
    const found = searchCustomers(book, '123456').map((r) => r.id)
    expect(found).toEqual(expect.arrayContaining(['1', '4']))
  })

  // TEST 8 — no result
  it('returns nothing for a number nobody has', () => {
    expect(searchCustomers(book, '9999999999')).toEqual([])
  })

  it('returns nothing for text nobody matches', () => {
    // The exact query that used to return the entire book.
    expect(searchCustomers(book, 'zzzqqq')).toEqual([])
  })

  // TEST 9 — duplicates
  it('returns both people sharing a number, and picks neither', () => {
    const found = searchCustomers(book, '0599123456')
    expect(found).toHaveLength(2)
    expect(found.map((r) => r.name)).toEqual(['أحمد محمد شاهين', 'سارة أحمد شاهين'])
  })

  // TEST 7 — the record beyond the old cap
  it('finds a subscriber far beyond the fiftieth row', () => {
    const many = [
      ...Array.from({ length: 120 }, (_, i) => ({
        id: `filler-${i}`, name: `عميل ${i}`, dialCode: '+970', phone: `5990000${String(i).padStart(3, '0')}`,
      })),
      { id: 'last', name: 'المشترك الأخير', dialCode: '+970', phone: '599777888' },
    ]
    expect(searchCustomers(many, '599777888').map((r) => r.id)).toEqual(['last'])
    expect(searchCustomers(many, 'الأخير').map((r) => r.id)).toEqual(['last'])
  })

  it('does not treat one or two digits as a phone search', () => {
    // Two digits match most of a book; that is noise, not a result.
    expect(matchesCustomer(book[0], '59')).toBe(false)
  })

  it('returns the whole book for an empty query', () => {
    expect(searchCustomers(book, '   ')).toHaveLength(book.length)
  })

  it('still matches a name when the query contains digits', () => {
    const rows = [{ id: 'x', name: 'عميل 2024', dialCode: '+970', phone: '599000111' }]
    expect(searchCustomers(rows, '2024').map((r) => r.id)).toEqual(['x'])
  })
})
