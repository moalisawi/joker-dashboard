/**
 * Pure money and date arithmetic for the subscriber lifecycle.
 *
 * These calculations used to live inline inside the Firestore transactions in
 * `app/api/subscriber-operations/route.ts`. Nothing there could be unit tested
 * without standing up Firestore, so eight financial operations — every payment,
 * renewal, refund, freeze and pause the business runs on — had zero coverage.
 * A wrong conversion here does not crash anything; it quietly writes a wrong
 * balance and nobody notices until the numbers are reconciled.
 *
 * Everything in this file is deliberately free of Firestore, `NextRequest`, and
 * ambient `Date.now()` reads: dates come in as arguments so the same input
 * always produces the same output, in any timezone.
 */

export const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Payments are allowed to exceed the subscription total by one cent. Converting
 * a local-currency amount to USD produces a repeating fraction often enough
 * that an exact-equality check would reject legitimate final payments.
 */
export const OVERPAY_TOLERANCE_USD = 0.01;

/** Guards against a divide-by-zero when a caller sends `exchangeRate: 0`. */
export const MIN_EXCHANGE_RATE = 0.000001;

export function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * An exchange rate that is safe to divide by.
 *
 * `asNumber` alone is not enough here: `Number(null)`, `Number("")` and
 * `Number([])` are all `0`, which is finite, so the fallback never fires and a
 * missing rate floors to {@link MIN_EXCHANGE_RATE} instead — turning a $50
 * payment into $50,000,000. The Zod schemas currently reject `null` before it
 * reaches this point, so that path is not live, but the guard should not
 * depend on a validator one layer up to stay correct.
 */
export function normalizeExchangeRate(value: unknown, fallback = 1): number {
  const missing = value == null || value === "" || (typeof value !== "number" && !Number.isFinite(Number(value)));
  const rate = missing ? fallback : asNumber(value, fallback);
  return Math.max(rate > 0 ? rate : fallback, MIN_EXCHANGE_RATE);
}

// ─── Dates ──────────────────────────────────────────────────────────────────
// All date maths is done on UTC midnight timestamps rather than through
// `Date.prototype.setDate`. `new Date("2026-06-10")` is parsed as UTC midnight
// but `setDate`/`getDate` read *local* components, so the two disagree by a day
// in any negative-offset timezone. Production runs on Vercel in UTC and so
// happened to be correct, but the helpers were one environment variable away
// from silently shifting every expiry date by a day.

/** Milliseconds at UTC midnight for a `YYYY-MM-DD` string. */
export function parseDateUTC(date: string): number {
  const [year, month, day] = String(date).split("-").map(Number);
  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    return Date.UTC(year, month - 1, day);
  }
  const parsed = new Date(date).getTime();
  return Number.isNaN(parsed) ? NaN : parsed;
}

/** `YYYY-MM-DD` for a UTC timestamp. */
export function formatDateUTC(ms: number): string {
  return new Date(ms).toISOString().split("T")[0];
}

export function addDays(date: string, days: number): string {
  return formatDateUTC(parseDateUTC(date) + Math.trunc(days) * DAY_MS);
}

/** Whole days elapsed between two dates; never negative. */
export function daysUsed(startDate: string, toDate: string): number {
  return Math.max(0, Math.floor((parseDateUTC(toDate) - parseDateUTC(startDate)) / DAY_MS));
}

/** Whole days left before an expiry date; never negative. */
export function remainingDays(expiryDate: string, fromDate: string): number {
  return Math.max(0, Math.ceil((parseDateUTC(expiryDate) - parseDateUTC(fromDate)) / DAY_MS));
}

/**
 * Days a subscription sat paused or frozen. Rounded up so a pause of any
 * length counts as at least one day, matching how the dashboard reports it.
 */
export function elapsedDaysSince(sinceMs: number | null, nowMs: number): number {
  return sinceMs == null ? 0 : Math.max(0, Math.ceil((nowMs - sinceMs) / DAY_MS));
}

// ─── addPayment ─────────────────────────────────────────────────────────────

export interface SubscriberBalance {
  paidAmountUSD: number;
  totalPriceUSD: number;
  refundAmountUSD: number;
  lockedRate: number;
}

export interface PaymentUpdate {
  amountUSD: number;
  paidAmountUSD: number;
  paidAmount: number;
  remainingAmountUSD: number;
  remainingAmount: number;
  netAmountUSD: number;
}

/**
 * Applies a payment to a subscriber's balance.
 *
 * @throws if the amount is not positive, or if it would push the total paid
 *         past the subscription price by more than {@link OVERPAY_TOLERANCE_USD}.
 *         A subscription with no price set (`totalPriceUSD <= 0`) is not capped.
 */
export function computePaymentUpdate(input: {
  amountOriginal: number;
  exchangeRate: number;
  current: SubscriberBalance;
}): PaymentUpdate {
  const { amountOriginal, current } = input;
  if (!(amountOriginal > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  const exchangeRate = normalizeExchangeRate(input.exchangeRate);
  const amountUSD = amountOriginal / exchangeRate;
  const paidAmountUSD = current.paidAmountUSD + amountUSD;

  if (current.totalPriceUSD > 0 && paidAmountUSD > current.totalPriceUSD + OVERPAY_TOLERANCE_USD) {
    throw new Error(
      `المبلغ يتجاوز الإجمالي — المدفوع: $${paidAmountUSD.toFixed(2)}, الإجمالي: $${current.totalPriceUSD.toFixed(2)}`
    );
  }

  const remainingAmountUSD = Math.max(0, current.totalPriceUSD - paidAmountUSD);
  const lockedRate = current.lockedRate;

  return {
    amountUSD,
    paidAmountUSD,
    paidAmount: paidAmountUSD * lockedRate,
    remainingAmountUSD,
    remainingAmount: remainingAmountUSD * lockedRate,
    netAmountUSD: Math.max(0, paidAmountUSD - current.refundAmountUSD),
  };
}

// ─── renewSubscription ──────────────────────────────────────────────────────

export interface RenewalTotals {
  totalPrice: number;
  totalPriceUSD: number;
  paidAmount: number;
  paidUSD: number;
  remaining: number;
  remainingUSD: number;
  netAmountUSD: number;
}

/**
 * Money for a renewal. A renewal resets the balance rather than adding to it —
 * the previous cycle's figures are snapshotted into `renewalHistory` first.
 *
 * `paidAmount: null` means "paid in full", which is how the renewal dialog
 * submits when the user does not touch the amount field.
 */
export function computeRenewalTotals(input: {
  totalPrice: number;
  paidAmount: number | null | undefined;
  exchangeRate: number;
}): RenewalTotals {
  const exchangeRate = normalizeExchangeRate(input.exchangeRate);
  const totalPrice = asNumber(input.totalPrice);
  const paidAmount = input.paidAmount == null ? totalPrice : asNumber(input.paidAmount);
  const paidUSD = paidAmount / exchangeRate;
  const remaining = Math.max(0, totalPrice - paidAmount);

  return {
    totalPrice,
    totalPriceUSD: totalPrice / exchangeRate,
    paidAmount,
    paidUSD,
    remaining,
    remainingUSD: remaining / exchangeRate,
    netAmountUSD: Math.max(0, paidUSD),
  };
}

/**
 * When the renewed cycle starts and ends.
 *
 * A subscriber renewing early keeps the unused tail of the current cycle: the
 * new term is appended to the old expiry date instead of starting today, so
 * renewing a week early does not throw that week away. A withdrawn or already
 * expired subscription restarts from the renewal date.
 */
export function resolveRenewalWindow(input: {
  subscriptionState: string;
  currentExpiryDate: string;
  renewalDate: string;
  duration: number;
}): { startDate: string; endDate: string } {
  const isWithdrawn = input.subscriptionState === "withdrawn";
  const oldExpiryDate = input.currentExpiryDate || input.renewalDate;
  const hasUnusedDays = remainingDays(oldExpiryDate, input.renewalDate) > 0;
  const startDate = !isWithdrawn && hasUnusedDays ? oldExpiryDate : input.renewalDate;

  return { startDate, endDate: addDays(startDate, input.duration) };
}

// ─── withdrawSubscriber ─────────────────────────────────────────────────────

export interface WithdrawalRefund {
  refundAmountUSD: number;
  hasRefund: boolean;
  newRefundAmountUSD: number;
  netAmountUSD: number;
}

/**
 * Refund figures for a withdrawal. Refunds accumulate — a subscriber refunded
 * once before and refunded again carries the sum — and net revenue floors at
 * zero so a refund larger than everything paid cannot report negative revenue.
 */
export function computeWithdrawalRefund(input: {
  refundAmount: number;
  exchangeRate: number;
  previousRefundUSD: number;
  paidAmountUSD: number;
}): WithdrawalRefund {
  const exchangeRate = normalizeExchangeRate(input.exchangeRate);
  const refundAmount = asNumber(input.refundAmount);
  const refundAmountUSD = refundAmount > 0 ? refundAmount / exchangeRate : 0;
  const newRefundAmountUSD = input.previousRefundUSD + refundAmountUSD;

  return {
    refundAmountUSD,
    hasRefund: refundAmountUSD > 0,
    newRefundAmountUSD,
    netAmountUSD: Math.max(0, input.paidAmountUSD - newRefundAmountUSD),
  };
}

// ─── pause / freeze / resume ────────────────────────────────────────────────

/**
 * Resuming preserves days rather than dates: whatever was left when the
 * subscription stopped is granted again from the resume date, so time spent
 * paused or frozen is not billed.
 */
export function computeResumeExpiry(preservedDays: number, fromDate: string): string {
  return addDays(fromDate, Math.max(0, asNumber(preservedDays)));
}
