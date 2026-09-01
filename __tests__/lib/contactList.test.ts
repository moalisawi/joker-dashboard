import {
  normalizePhone,
  buildContactList,
  describeContactList,
  CONTACT_FORMATS,
} from '@/lib/contactList'

/*
 * Campaign lists.
 *
 * The damage here is not a crash. A list with a duplicate sends the same person
 * the same offer twice; a list that silently drops three people looks identical
 * to one that did not, and nobody finds out until the follow-up that never came.
 * Both are pinned below.
 */

const p = (dialCode: string, phone: string, name = 'م') => ({ name, dialCode, phone })

describe('normalizePhone', () => {
  it('joins the dial code and strips punctuation and spaces', () => {
    expect(normalizePhone(p('+970', '567 176-354'))).toBe('970567176354')
  })

  it('rejects a number too short to be real rather than returning something broken', () => {
    expect(normalizePhone(p('+970', '123'))).toBeNull()
    expect(normalizePhone({ name: 'x' })).toBeNull()
    expect(normalizePhone(p('', ''))).toBeNull()
  })

  it('keeps a bare number that is already long enough', () => {
    expect(normalizePhone({ phone: '00970567176354' })).toBe('00970567176354')
  })
})

describe('buildContactList', () => {
  const rows = [p('+970', '567176354'), p('+966', '530241340'), p('+962', '774615226')]

  it('writes wa.me links, one per line', () => {
    const l = buildContactList(rows, 'wa_link')
    expect(l.text.split('\n')).toEqual([
      'https://wa.me/970567176354',
      'https://wa.me/966530241340',
      'https://wa.me/962774615226',
    ])
    expect(l.included).toBe(3)
  })

  it('writes bare digits — what most bulk senders accept', () => {
    expect(buildContactList(rows, 'digits').text.split('\n')[0]).toBe('970567176354')
  })

  it('writes the international form with a leading +', () => {
    expect(buildContactList(rows, 'international').text.split('\n')[0]).toBe('+970567176354')
  })

  it('removes duplicates — a shared phone must not be messaged twice', () => {
    // A couple, or a parent paying for a child: two subscribers, one phone.
    const l = buildContactList([p('+970', '567176354', 'أب'), p('+970', '567176354', 'ابن')], 'digits')
    expect(l.included).toBe(1)
    expect(l.duplicates).toBe(1)
    expect(l.text.split('\n')).toHaveLength(1)
  })

  it('treats differently punctuated versions of one number as the same number', () => {
    const l = buildContactList([p('+970', '567 176 354'), p('970', '567-176-354')], 'digits')
    expect(l.included).toBe(1)
    expect(l.duplicates).toBe(1)
  })

  it('COUNTS unusable rows instead of dropping them quietly', () => {
    const l = buildContactList([p('+970', '567176354'), p('+970', '12'), { name: 'بلا هاتف' }], 'digits')
    expect(l.included).toBe(1)
    expect(l.skipped).toBe(2)
  })

  it('returns empty text rather than throwing on an empty selection', () => {
    expect(buildContactList([], 'wa_link')).toEqual({ text: '', included: 0, skipped: 0, duplicates: 0 })
  })

  it('preserves the order of the rows it was given', () => {
    // The table is already sorted by whatever the user chose; the list must not
    // reshuffle it, or the campaign stops matching what they were looking at.
    const l = buildContactList([p('+962', '774615226'), p('+970', '567176354')], 'digits')
    expect(l.text.split('\n')).toEqual(['962774615226', '970567176354'])
  })
})

describe('describeContactList', () => {
  it('reports only the count when nothing was lost', () => {
    expect(describeContactList({ text: '', included: 27, skipped: 0, duplicates: 0 }))
      .toBe('نُسخ 27 رقماً')
  })

  it('names what was removed, so the number is explainable', () => {
    expect(describeContactList({ text: '', included: 24, skipped: 2, duplicates: 1 }))
      .toBe('نُسخ 24 رقماً · 1 مكرّر أُزيل · 2 بلا رقم صالح')
  })
})

describe('CONTACT_FORMATS', () => {
  it('offers each format exactly once, with a hint explaining when to use it', () => {
    const ids = CONTACT_FORMATS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CONTACT_FORMATS.every((f) => f.hint.length > 0)).toBe(true)
  })
})
