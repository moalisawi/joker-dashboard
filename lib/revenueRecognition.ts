/**
 * Cash is not revenue.
 *
 * When a subscriber pays $300 for a 90-day plan, the business has not earned
 * $300 that day — it has earned $3.33 a day for 90 days, and until it delivers
 * those days the rest is money it owes back in service. The dashboard called
 * that whole $300 "إيراد الشهر", which flatters a good month, hides a bad one,
 * and makes two months impossible to compare when plan lengths differ.
 *
 * Three different numbers, none of which is wrong, all of which were one:
 *
 *   نقد محصَّل      what arrived in the period      (from payments)
 *   إيراد مستحق     what was earned in the period   (straight-line, here)
 *   إيراد مؤجَّل     collected but not yet earned    (a liability, here)
 *
 * Recognition is straight-line by day, which is what a fixed-term gym or
 * nutrition plan actually is: `duration` is a day count and the service is
 * delivered evenly across it.
 *
 * Recognition follows the CONTRACT, not the payment. A subscriber halfway
 * through a plan they have only half paid has still consumed half the service,
 * so half is earned and the unpaid part shows up as a receivable — which is
 * exactly what the outstanding figure already reports. Recognising only what
 * was collected would double-count the same shortfall.
 */

export interface RecognizableSubscriber {
  /** Service start, YYYY-MM-DD. */
  date?: string;
  startDate?: string;
  /** Length of the term in days. */
  duration?: number;
  totalPriceUSD?: number;
  paidAmountUSD?: number;
  subscriptionState?: string;
}

const DAY_MS = 86_400_000;

/** Parses YYYY-MM-DD as UTC midnight so no timezone can shift a boundary. */
function utcDay(d: string | undefined): number | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return null;
  return Date.UTC(y, m - 1, day);
}

interface Span { start: number; end: number; daily: number; days: number }

/** The service window and its daily rate, or null when the record cannot say. */
export function serviceSpan(s: RecognizableSubscriber): Span | null {
  const start = utcDay(s.startDate ?? s.date);
  const days = Number(s.duration) || 0;
  const price = Number(s.totalPriceUSD) || 0;
  if (start === null || days <= 0) return null;
  return { start, end: start + days * DAY_MS, daily: price / days, days };
}

/** Whole days of `span` that fall inside [from, to], both inclusive. */
function overlapDays(span: Span, from: number, to: number): number {
  const lo = Math.max(span.start, from);
  const hi = Math.min(span.end, to + DAY_MS);
  return hi <= lo ? 0 : Math.round((hi - lo) / DAY_MS);
}

/** Revenue earned by one subscription between two dates, inclusive. */
export function recognizedInPeriod(
  s: RecognizableSubscriber,
  fromDate: string,
  toDate: string,
): number {
  const span = serviceSpan(s);
  const from = utcDay(fromDate);
  const to = utcDay(toDate);
  if (!span || from === null || to === null || to < from) return 0;
  return overlapDays(span, from, to) * span.daily;
}

/** Revenue earned from the start of the term up to and including `asOf`. */
export function recognizedToDate(s: RecognizableSubscriber, asOf: string): number {
  const span = serviceSpan(s);
  const at = utcDay(asOf);
  if (!span || at === null) return 0;
  return overlapDays(span, span.start, at) * span.daily;
}

/**
 * Money taken for service not yet delivered — a liability, not profit.
 *
 * Floored at zero: a subscriber who has paid less than they have consumed is a
 * receivable, not negative deferred revenue, and the outstanding figure already
 * carries that.
 */
export function deferredAsOf(s: RecognizableSubscriber, asOf: string): number {
  const paid = Number(s.paidAmountUSD) || 0;
  return Math.max(0, paid - recognizedToDate(s, asOf));
}

export interface RevenueSummary {
  /** Earned inside the period. */
  recognizedUSD: number;
  /** Collected but not yet earned, as at `asOf`. */
  deferredUSD: number;
  /** Subscriptions that could not be recognised — no start date or no duration. */
  unrecognizable: number;
}

export function summarizeRevenue(
  subscribers: RecognizableSubscriber[],
  fromDate: string,
  toDate: string,
  asOf: string,
): RevenueSummary {
  let recognizedUSD = 0;
  let deferredUSD = 0;
  let unrecognizable = 0;

  for (const s of subscribers) {
    if (!serviceSpan(s)) {
      // Counted rather than silently skipped: a total that quietly omits records
      // is the kind of number nobody can reconcile later.
      unrecognizable++;
      continue;
    }
    recognizedUSD += recognizedInPeriod(s, fromDate, toDate);
    deferredUSD += deferredAsOf(s, asOf);
  }

  return { recognizedUSD, deferredUSD, unrecognizable };
}
