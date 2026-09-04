import {
  differsFromStored,
  findImmutableViolations,
  immutableRefusalMessage,
  pickWritable,
} from '@/lib/subscriberWriteGuard'
import {
  CREATE_WRITABLE_SUBSCRIBER_FIELDS,
  UPDATE_WRITABLE_SUBSCRIBER_FIELDS,
} from '@/constants/subscriberFieldPolicy'

/**
 * What these prove.
 *
 * `updateSubscriber` and `createSubscriber` shared one allow-list, so every term
 * of the sale — price, exchange rate, currency, duration, package, expiry, the
 * dates revenue is recognised from — could be PATCHed onto a record that had
 * already been invoiced. Nothing in the ledger would say it happened. The edit
 * dialog rarely offered those boxes, which made the door unlocked rather than
 * advertised: a direct POST carrying `{ totalPrice: 999999 }` was accepted.
 *
 * A test that only checked the dialog would prove nothing. These call the guard
 * the server calls, with the payloads a caller can actually send.
 */

/** A subscriber as stored after a $50 monthly signup. */
const stored = {
  name: 'أحمد محمد',
  phone: '599123456',
  notes: 'ملاحظة',
  totalPrice: 50,
  totalPriceUSD: 50,
  lockedRate: 1,
  currencyOriginal: 'USD',
  duration: 30,
  package: 'فضية',
  expiryDate: '2026-10-06',
  date: '2026-09-06',
  startDate: '2026-09-06',
  paidAmountUSD: 50,
}

describe('editing a customer', () => {
  it('lets the name through', () => {
    expect(findImmutableViolations({ name: 'أحمد محمد شاهين' }, stored)).toEqual([])
    expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has('name')).toBe(true)
  })

  it('lets the phone through', () => {
    expect(findImmutableViolations({ phone: '599999999', dialCode: '+970' }, stored)).toEqual([])
    expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has('phone')).toBe(true)
    expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has('dialCode')).toBe(true)
  })

  it('lets notes through', () => {
    expect(findImmutableViolations({ notes: 'كلّمته اليوم' }, stored)).toEqual([])
    expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has('notes')).toBe(true)
  })

  it('lets residence, source and assignment through', () => {
    for (const field of ['residence', 'source', 'sourceDetail', 'referrer', 'team', 'convincedBy']) {
      expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has(field)).toBe(true)
    }
  })
})

describe('the terms of the sale are refused', () => {
  it('refuses a raised price', () => {
    // The exact payload from the brief.
    expect(findImmutableViolations({ totalPrice: 999999 }, stored)).toEqual(['totalPrice'])
  })

  it('refuses a lowered price', () => {
    expect(findImmutableViolations({ totalPriceUSD: 1 }, stored)).toEqual(['totalPriceUSD'])
  })

  it('refuses a rewritten exchange rate', () => {
    expect(findImmutableViolations({ lockedRate: 3.65 }, stored)).toEqual(['lockedRate'])
  })

  it('refuses a changed currency', () => {
    expect(findImmutableViolations({ currencyOriginal: 'ILS' }, stored)).toEqual(['currencyOriginal'])
  })

  it('refuses a changed duration or package', () => {
    expect(findImmutableViolations({ duration: 90 }, stored)).toEqual(['duration'])
    expect(findImmutableViolations({ package: 'ذهبية' }, stored)).toEqual(['package'])
  })

  it('refuses a pushed-out expiry date', () => {
    // Expiry moves through freeze and resume, which recompute it from preserved
    // days. Typing it in afterwards is free service with no record of the grant.
    expect(findImmutableViolations({ expiryDate: '2027-01-01' }, stored)).toEqual(['expiryDate'])
  })

  it('refuses a re-dated subscription', () => {
    // revenueRecognition spreads revenue from these dates; moving one silently
    // moves earned revenue into another month.
    expect(findImmutableViolations({ date: '2026-01-01' }, stored)).toEqual(['date'])
    expect(findImmutableViolations({ startDate: '2026-01-01' }, stored)).toEqual(['startDate'])
  })

  it('names every field it refuses at once', () => {
    const violations = findImmutableViolations(
      { name: 'اسم جديد', totalPrice: 999999, currencyOriginal: 'ILS', expiryDate: '2027-01-01' },
      stored
    )
    expect(violations).toEqual(['currencyOriginal', 'totalPrice', 'expiryDate'])
    const message = immutableRefusalMessage(violations)
    expect(message).toContain('السعر')
    expect(message).toContain('العملة')
    expect(message).toContain('تاريخ الانتهاء')
    // The refusal has to say what path is open, or the next attempt is a workaround.
    expect(message).toContain('التجديد')
  })

  it('strips them even when the refusal does not fire', () => {
    // Belt and braces: an unchanged echo passes the violation check, and must
    // still not reach the write.
    const safe = pickWritable(
      { name: 'اسم', totalPrice: 50, expiryDate: '2026-10-06' },
      UPDATE_WRITABLE_SUBSCRIBER_FIELDS
    )
    expect(safe).toEqual({ name: 'اسم' })
  })
})

describe('an unchanged echo is not an edit', () => {
  it('accepts the whole record sent back untouched', () => {
    // The edit dialog used to send every field on every save. Refusing on
    // presence would mean nobody could fix a spelling.
    expect(findImmutableViolations({ ...stored, name: 'اسم مصحّح' }, stored)).toEqual([])
  })

  it('tolerates a float that survived a text input', () => {
    // 49.999999999999996 is the same $50, not a repricing.
    expect(differsFromStored(49.999999999999996, 50)).toBe(false)
    expect(differsFromStored('50', 50)).toBe(false)
    expect(differsFromStored(50.02, 50)).toBe(true)
  })

  it('treats an omitted field as not sent, never as cleared', () => {
    expect(differsFromStored(undefined, 50)).toBe(false)
    expect(differsFromStored(null, 50)).toBe(false)
    expect(findImmutableViolations({ name: 'اسم' }, stored)).toEqual([])
  })
})

describe('selling is not editing', () => {
  it('still allows every term of the sale at creation', () => {
    // The hardening must not break a signup: creation is where these are set.
    for (const field of [
      'totalPrice', 'totalPriceUSD', 'lockedRate', 'currencyOriginal',
      'duration', 'package', 'expiryDate', 'date', 'startDate',
    ]) {
      expect(CREATE_WRITABLE_SUBSCRIBER_FIELDS.has(field)).toBe(true)
      expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has(field)).toBe(false)
    }
  })

  it('is the only difference between the two sets', () => {
    const onlyOnCreate = [...CREATE_WRITABLE_SUBSCRIBER_FIELDS]
      .filter((f) => !UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has(f))
      .sort()
    expect(onlyOnCreate).toEqual([
      'currencyOriginal', 'date', 'duration', 'expiryDate', 'lockedRate',
      'package', 'startDate', 'totalPrice', 'totalPriceUSD',
    ])
    // Nothing is editable that was not creatable.
    const onlyOnUpdate = [...UPDATE_WRITABLE_SUBSCRIBER_FIELDS]
      .filter((f) => !CREATE_WRITABLE_SUBSCRIBER_FIELDS.has(f))
    expect(onlyOnUpdate).toEqual([])
  })

  it('leaves balances owned by the server on both paths', () => {
    for (const field of ['paidAmountUSD', 'remainingAmountUSD', 'netAmountUSD', 'refundAmountUSD']) {
      expect(CREATE_WRITABLE_SUBSCRIBER_FIELDS.has(field)).toBe(false)
      expect(UPDATE_WRITABLE_SUBSCRIBER_FIELDS.has(field)).toBe(false)
    }
  })
})
