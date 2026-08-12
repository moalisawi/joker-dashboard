import type { Timestamp } from "firebase/firestore";
import type { Currency, PackageType } from "./subscriber";

/**
 * The billing ledger.
 *
 * Until now one `subscribers` document answered every financial question at
 * once. `renewSubscription` overwrote it in place — price, paid, remaining, the
 * lot — and pushed the old values into a `renewalHistory` sub-collection. That
 * works for "what does this person owe right now" and fails for everything
 * else: there is no record of what was *invoiced* as opposed to what was
 * eventually paid, no due dates, and no way to express an instalment plan, so
 * "المتبقي: $120" could mean overdue by a month or not due until March.
 *
 * These five documents separate the concepts the business already runs on:
 *
 *   SubscriptionCycle  a term of service — one per signup or renewal
 *   Invoice            what was billed for that cycle
 *   Installment        one dated slice of an invoice
 *   Payment            money that actually arrived (types/payment.ts)
 *   Refund             money that went back (types/refund.ts)
 *
 * The summary fields on `subscribers` are untouched and still written on every
 * operation. They are the compatibility surface: every existing screen, report
 * and export reads them, and a subscriber created before any of this exists
 * renders from them alone. See legacyToCurrentCycleView() in
 * lib/subscriberLifecycle.ts.
 *
 * All amounts follow the convention already in the codebase: `*Original` is the
 * amount in the currency the customer actually paid in, `*USD` is the converted
 * figure that every total and report is denominated in.
 */

// ─── Status vocabularies ──────────────────────────────────────────────────────
//
// Three separate axes, deliberately not collapsed into one field. A subscription
// can be operationally frozen while billed in full and due for renewal; the old
// single `status` string could only say one of those things at a time.

/** Where the service stands. */
export type CycleStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "withdrawn"
  | "frozen"
  | "paused";

/** Where the money stands. */
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void"
  | "refunded";

export type InstallmentStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled";

export type PaymentPlanType = "full" | "installments";

/** How often instalments fall due. `custom` means the dates were set by hand. */
export type InstallmentFrequency = "weekly" | "biweekly" | "monthly" | "custom";

// ─── Receipts ─────────────────────────────────────────────────────────────────

/**
 * Proof-of-payment state, tracked separately from the money.
 *
 * A payment counts toward the balance the moment it is recorded — that is
 * deliberate and unchanged. `receiptStatus` answers a different question: has
 * anyone actually checked the transfer slip? Conflating the two would mean a
 * cash payment with no slip silently reads as unpaid, and the subscriber gets
 * chased for money they handed over.
 */
export type ReceiptStatus = "missing" | "pending_review" | "verified" | "rejected";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  missing:        "بلا وصل",
  pending_review: "بانتظار المراجعة",
  verified:       "مُتحقق منه",
  rejected:       "مرفوض",
};

/** Bank/e-wallet reconciliation state for a payment. */
export type SettlementStatus = "unreconciled" | "reconciled" | "disputed";

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  unreconciled: "غير مطابَق",
  reconciled:   "مطابَق",
  disputed:     "متنازع عليه",
};

// ─── Arabic labels ────────────────────────────────────────────────────────────

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  active:    "نشطة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  withdrawn: "منسحب",
  frozen:    "مجمّدة",
  paused:    "موقوفة",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          "مسودة",
  issued:         "صادرة",
  partially_paid: "مدفوعة جزئياً",
  paid:           "مدفوعة",
  overdue:        "متأخرة",
  void:           "ملغاة",
  refunded:       "مُستردة",
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending:        "مستحق لاحقاً",
  partially_paid: "مدفوع جزئياً",
  paid:           "مدفوع",
  overdue:        "متأخر",
  waived:         "مُعفى",
  cancelled:      "ملغي",
};

export const INSTALLMENT_FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  weekly:   "أسبوعي",
  biweekly: "كل أسبوعين",
  monthly:  "شهري",
  custom:   "مخصص",
};

// ─── SubscriptionCycle ────────────────────────────────────────────────────────

export interface SubscriptionCycle {
  id?: string;

  subscriberId: string;
  subscriberName: string;
  /**
   * Denormalised so firestore.rules can scope a cycle read to the employee who
   * owns the subscriber, exactly as payments and refunds are scoped. Without it
   * every cycle would be staff-only.
   */
  convincedByUid?: string | null;

  /** 1 for the original signup; incremented on every renewal. */
  cycleNumber: number;

  package: PackageType | string;
  duration: number;
  startDate: string;   // YYYY-MM-DD
  expiryDate: string;  // YYYY-MM-DD

  status: CycleStatus;

  currencyOriginal: Currency;
  listPriceOriginal: number;
  discountOriginal: number;
  totalPriceOriginal: number;
  exchangeRate: number;

  totalPriceUSD: number;
  paidAmountUSD: number;
  remainingAmountUSD: number;
  refundAmountUSD: number;
  netAmountUSD: number;

  invoiceId?: string | null;

  /** Set when the cycle stops being the current one. */
  closedAt?: Timestamp | null;
  closedReason?: string | null;

  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id?: string;

  /** Human-facing, e.g. `INV-2026-000042`. Unique; see nextInvoiceNumber(). */
  invoiceNumber: string;

  subscriberId: string;
  subscriberName: string;
  convincedByUid?: string | null;

  cycleId: string;
  cycleNumber: number;

  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD

  currencyOriginal: Currency;
  subtotalOriginal: number;
  discountOriginal: number;
  totalOriginal: number;
  exchangeRate: number;

  totalUSD: number;
  paidUSD: number;
  remainingUSD: number;
  refundedUSD: number;

  status: InvoiceStatus;
  paymentPlanType: PaymentPlanType;
  /** 0 when paid in full up front. */
  installmentCount: number;

  notes?: string | null;

  /** Voiding is the only way an invoice leaves circulation — never deletion. */
  voidedAt?: Timestamp | null;
  voidedBy?: string | null;
  voidReason?: string | null;

  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── Installment ──────────────────────────────────────────────────────────────

export interface Installment {
  id?: string;

  invoiceId: string;
  subscriberId: string;
  subscriberName?: string;
  convincedByUid?: string | null;
  cycleId: string;

  /** 1-based, in due-date order. */
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD

  amountOriginal: number;
  amountUSD: number;
  paidUSD: number;
  remainingUSD: number;

  status: InstallmentStatus;

  paidAt?: Timestamp | null;
  /** Every payment that contributed, oldest first. */
  paymentIds?: string[];

  notes?: string | null;

  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── PaymentAdjustment ────────────────────────────────────────────────────────

/**
 * A correction to money already recorded.
 *
 * Payments are immutable by design — the ledger is a record of what happened,
 * and editing a payment rewrites history rather than correcting it. When a
 * payment was entered wrongly, or a discount is granted after the invoice went
 * out, or a balance is written off as uncollectable, the fix is a second,
 * signed document that offsets the first. Both survive, and the audit trail
 * shows the mistake *and* the correction, which is the whole point.
 *
 * `amountUSD` is signed: negative reverses money (a correction downward, a
 * discount, a write-off), positive adds it back. The subscriber, cycle and
 * invoice totals all move by exactly this figure.
 */
export interface PaymentAdjustment {
  id?: string;

  subscriberId: string;
  subscriberName: string;
  convincedByUid?: string | null;

  /** The payment being corrected, when the adjustment targets one. */
  paymentId?: string | null;
  invoiceId?: string | null;
  cycleId?: string | null;

  adjustmentType: import("@/constants/billing").AdjustmentType;
  /** Signed. Negative removes money from the balance. */
  amountUSD: number;
  currencyOriginal: Currency;
  amountOriginal: number;
  exchangeRate: number;

  /** Never optional. An adjustment with no stated reason is an unexplained edit. */
  reason: string;
  notes?: string | null;

  /** Recorded above ADJUSTMENT_APPROVAL_THRESHOLD_USD. */
  approvedBy?: string | null;
  approvedByName?: string | null;

  date: string; // YYYY-MM-DD

  createdAt?: Timestamp;
  createdBy?: string;
  createdByName?: string;
}

// ─── SettlementBatch ──────────────────────────────────────────────────────────

/**
 * A reconciliation run against one payment method for one period.
 *
 * Foundation only — nothing creates these yet. The fields exist so the payment
 * documents can carry `settlementBatchId` from day one rather than needing a
 * backfill when reconciliation is built.
 */
export interface SettlementBatch {
  id?: string;

  paymentMethodId: string;
  paymentMethodName: string;

  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD

  expectedTotalUSD: number;
  actualTotalOriginal: number;
  actualTotalUSD: number;
  differenceUSD: number;

  status: "draft" | "reconciled" | "disputed";
  paymentIds: string[];
  notes?: string | null;

  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}
