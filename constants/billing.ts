/**
 * Billing limits that both the browser and the server must agree on.
 *
 * Free of every import so it can be read from a Zod schema, a pure helper and a
 * Firestore transaction alike.
 */

/**
 * The most instalments one invoice may carry.
 *
 * A transaction-budget limit, not a business preference: an invoice and its
 * schedule are written in a single Firestore transaction — that atomicity is the
 * point, since an invoice claiming twelve instalments that do not exist is worse
 * than no invoice — and Firestore caps a transaction at 500 writes.
 *
 * 60 monthly instalments is five years, past anything this business sells, so
 * the cap costs nothing in practice. What it must not be is a number repeated in
 * three files that quietly disagree; `assertWriteBudget()` in
 * lib/serverBillingLedger.ts turns it into a checked invariant.
 */
export const MAX_INSTALLMENTS = 60;

/** Days between instalments, by frequency. Monthly is a flat 30 days, matching
 *  how `duration` and every expiry date in this system already work. */
export const FREQUENCY_DAYS = { weekly: 7, biweekly: 14, monthly: 30 } as const;

/** Reasons a payment adjustment can be raised. */
export const ADJUSTMENT_TYPES = ["correction", "discount", "write_off"] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  correction: "تصحيح قيد",
  discount:   "خصم لاحق",
  write_off:  "إعدام دين",
};

export const ADJUSTMENT_TYPE_HINTS: Record<AdjustmentType, string> = {
  correction: "الدفعة سُجّلت بمبلغ أو تاريخ خاطئ",
  discount:   "خصم مُنح بعد إصدار الفاتورة",
  write_off:  "مبلغ لن يُحصَّل ويُشطب من المستحقات",
};

/**
 * Above this amount an adjustment names an approver.
 *
 * Not an enforcement threshold — nothing blocks on it — but the audit entry and
 * the confirmation both say so, which is what makes a large write-off a
 * deliberate act rather than a two-click one.
 */
export const ADJUSTMENT_APPROVAL_THRESHOLD_USD = 100;
