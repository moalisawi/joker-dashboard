/**
 * The subscriber lifecycle, expressed as pure functions.
 *
 * Two things were tangled together and are separated here.
 *
 * **Status.** One `status` string ("نشط" / "منتهي" / "موقوف" …) was carrying
 * three unrelated questions at once — is the service running, is the money in,
 * is it time to renew — so it could only ever answer one. A subscription that
 * is frozen, fully paid and due for renewal in nine days has three different
 * true answers, and the single field had to pick. The three `derive*` functions
 * below each answer one question, from the data that actually determines it.
 *
 * **Instalments.** There were none: `remainingAmountUSD` was a single running
 * balance with no dates attached, so "المتبقي $120" could mean overdue by a
 * month or not due until March, and nothing could tell the difference. The
 * schedule and allocation helpers here give that balance dates and an order.
 *
 * Everything is free of Firestore and of ambient `Date.now()` — today comes in
 * as an argument — so the same inputs always produce the same output, in any
 * timezone, and all of it is unit-testable without standing up an emulator.
 */

import { FREQUENCY_DAYS, MAX_INSTALLMENTS } from "@/constants/billing";
import {
  OVERPAY_TOLERANCE_USD,
  addDays,
  asNumber,
  parseDateUTC,
  remainingDays,
} from "@/lib/subscriberFinance";
import type {
  CycleStatus,
  Installment,
  InstallmentFrequency,
  InstallmentStatus,
  InvoiceStatus,
  PaymentPlanType,
  ReceiptStatus,
  SubscriptionCycle,
} from "@/types/billing";

// ─── Operational status ───────────────────────────────────────────────────────

export type OperationalStatus = "active" | "paused" | "frozen" | "withdrawn" | "expired";

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  active:    "نشط",
  paused:    "موقوف",
  frozen:    "مجمّد",
  withdrawn: "منسحب",
  expired:   "منتهي",
};

interface OperationalInput {
  subscriptionState?: string | null;
  subscriptionStatus?: string | null;
  freezeData?: { isFrozen?: boolean } | null;
  expiryDate?: string | null;
}

/**
 * Is the service running?
 *
 * Order matters and is not arbitrary: withdrawal is terminal, a freeze outranks
 * a pause because freezing is the stronger hold, and expiry is only reached
 * when none of the deliberate holds apply. Reading the raw fields in a
 * different order — which several components did — is how the same subscriber
 * showed as "موقوف" on one screen and "منتهي" on another.
 */
export function deriveOperationalStatus(
  subscriber: OperationalInput,
  today: string,
  cycle?: Pick<SubscriptionCycle, "status" | "expiryDate"> | null
): OperationalStatus {
  if (subscriber.subscriptionState === "withdrawn" || cycle?.status === "withdrawn") return "withdrawn";
  if (subscriber.freezeData?.isFrozen === true || cycle?.status === "frozen") return "frozen";
  if (subscriber.subscriptionStatus === "paused" || cycle?.status === "paused") return "paused";

  const expiry = cycle?.expiryDate ?? subscriber.expiryDate ?? "";
  if (expiry && remainingDays(expiry, today) <= 0) return "expired";
  return "active";
}

// ─── Billing status ───────────────────────────────────────────────────────────

export interface BillingInput {
  totalUSD: number;
  paidUSD: number;
  refundedUSD?: number;
  /** Absent means nothing is scheduled, so nothing can be overdue. */
  dueDate?: string | null;
  voided?: boolean;
}

/**
 * Is the money in?
 *
 * `paid >= total` uses the same one-cent tolerance the payment guard does.
 * Currency conversion produces repeating fractions often enough that an exact
 * comparison leaves a fully-settled invoice reading as partially paid forever,
 * over a third of a cent.
 */
export function deriveBillingStatus(input: BillingInput, today: string): InvoiceStatus {
  if (input.voided) return "void";

  const total    = asNumber(input.totalUSD);
  const paid     = asNumber(input.paidUSD);
  const refunded = asNumber(input.refundedUSD);

  // A full refund is a distinct outcome from an unpaid invoice: the money came
  // in and went back out, and the reports need to tell those apart.
  if (refunded > 0 && refunded >= paid - OVERPAY_TOLERANCE_USD && paid > 0) return "refunded";

  if (total <= 0) return "paid";
  if (paid >= total - OVERPAY_TOLERANCE_USD) return "paid";

  const isOverdue = Boolean(input.dueDate) && parseDateUTC(input.dueDate as string) < parseDateUTC(today);
  if (isOverdue) return "overdue";

  return paid > 0 ? "partially_paid" : "issued";
}

// ─── Renewal status ───────────────────────────────────────────────────────────

export type DerivedRenewalStatus =
  | "upcoming"
  | "due"
  | "contacted"
  | "promised"
  | "renewed"
  | "declined"
  | "expired"
  | "not_due";

export const DERIVED_RENEWAL_LABELS: Record<DerivedRenewalStatus, string> = {
  upcoming:  "ينتهي قريباً",
  due:       "حان التجديد",
  contacted: "تم التواصل",
  promised:  "وعد بالدفع",
  renewed:   "تم التجديد",
  declined:  "رفض التجديد",
  expired:   "منتهي",
  not_due:   "غير مستحق",
};

/** Days before expiry at which a subscription enters each renewal window. */
export const RENEWAL_WINDOW_DAYS = { upcoming: 30, due: 14, urgent: 7 } as const;

/**
 * Should someone be calling this subscriber?
 *
 * A manually-set outcome always wins over the date arithmetic. Someone who
 * spoke to the customer yesterday and recorded "وعد بالدفع" knows more than the
 * calendar does, and having the queue silently reset them to "حان التجديد"
 * every morning is how a follow-up list stops being trusted.
 */
export function deriveRenewalStatus(
  input: {
    expiryDate?: string | null;
    renewalWorkflowStatus?: string | null;
    subscriptionState?: string | null;
  },
  today: string
): DerivedRenewalStatus {
  const manual = input.renewalWorkflowStatus;
  if (manual === "renewed")   return "renewed";
  if (manual === "declined")  return "declined";
  if (manual === "promised")  return "promised";
  if (manual === "contacted") return "contacted";

  if (input.subscriptionState === "withdrawn") return "not_due";
  if (!input.expiryDate) return "not_due";

  const left = remainingDays(input.expiryDate, today);
  if (left <= 0) return "expired";
  if (left <= RENEWAL_WINDOW_DAYS.due) return "due";
  if (left <= RENEWAL_WINDOW_DAYS.upcoming) return "upcoming";
  return "not_due";
}

// ─── Legacy compatibility ─────────────────────────────────────────────────────

export interface CurrentCycleView {
  cycleId: string | null;
  cycleNumber: number;
  package: string;
  duration: number;
  startDate: string;
  expiryDate: string;
  currencyOriginal: string;
  exchangeRate: number;
  totalPriceUSD: number;
  paidAmountUSD: number;
  remainingAmountUSD: number;
  refundAmountUSD: number;
  netAmountUSD: number;
  /** False when this was reconstructed from the subscriber document. */
  fromCycleDocument: boolean;
}

/**
 * The current cycle, whether or not one has ever been written.
 *
 * Every subscriber that existed before `subscriptionCycles` has no cycle
 * document and never will unless someone runs the backfill — and the backfill
 * is optional on purpose. The billing UI asks for this instead of reading
 * either source directly, so a 2024 subscriber and one created this morning
 * render through the same code path and the older one is not a special case
 * scattered across six components.
 *
 * `fromCycleDocument: false` is surfaced in the UI rather than hidden: a cycle
 * reconstructed from summary fields has no invoice and no instalments behind
 * it, and pretending otherwise would promise history that is not there.
 */
export function legacyToCurrentCycleView(
  subscriber: Record<string, unknown>,
  cycle?: SubscriptionCycle | null
): CurrentCycleView {
  if (cycle) {
    return {
      cycleId:            cycle.id ?? null,
      cycleNumber:        cycle.cycleNumber,
      package:            String(cycle.package ?? ""),
      duration:           cycle.duration,
      startDate:          cycle.startDate,
      expiryDate:         cycle.expiryDate,
      currencyOriginal:   cycle.currencyOriginal,
      exchangeRate:       cycle.exchangeRate,
      totalPriceUSD:      cycle.totalPriceUSD,
      paidAmountUSD:      cycle.paidAmountUSD,
      remainingAmountUSD: cycle.remainingAmountUSD,
      refundAmountUSD:    cycle.refundAmountUSD,
      netAmountUSD:       cycle.netAmountUSD,
      fromCycleDocument:  true,
    };
  }

  const s = subscriber;
  const paid     = asNumber(s.paidAmountUSD);
  const total    = asNumber(s.totalPriceUSD);
  const refunded = asNumber(s.refundAmountUSD);

  return {
    cycleId:     null,
    // renewalCount is the number of renewals, so the cycle a subscriber is in
    // is one more than that: no renewals means cycle #1.
    cycleNumber: asNumber(s.renewalCount) + 1,
    package:     String(s.package ?? ""),
    duration:    asNumber(s.duration),
    startDate:   String(s.startDate ?? s.date ?? ""),
    expiryDate:  String(s.expiryDate ?? ""),
    currencyOriginal: String(s.currencyOriginal ?? "USD"),
    exchangeRate:     asNumber(s.lockedRate, 1),
    totalPriceUSD:      total,
    paidAmountUSD:      paid,
    remainingAmountUSD: asNumber(s.remainingAmountUSD, Math.max(0, total - paid)),
    refundAmountUSD:    refunded,
    netAmountUSD:       asNumber(s.netAmountUSD, Math.max(0, paid - refunded)),
    fromCycleDocument:  false,
  };
}

/** The cycle status implied by an operational status. */
export function operationalToCycleStatus(status: OperationalStatus): CycleStatus {
  switch (status) {
    case "withdrawn": return "withdrawn";
    case "frozen":    return "frozen";
    case "paused":    return "paused";
    case "expired":   return "completed";
    default:          return "active";
  }
}

// ─── Instalment schedules ─────────────────────────────────────────────────────

export interface ScheduleInput {
  /** Total to spread, in the customer's currency. */
  totalOriginal: number;
  exchangeRate: number;
  count: number;
  firstDueDate: string;
  frequency: InstallmentFrequency;
  /** Required when frequency is "custom"; one date per instalment. */
  customDates?: string[];
  /** Already collected up front; excluded from the schedule. */
  downPaymentOriginal?: number;
}

export interface ScheduledInstallment {
  installmentNumber: number;
  dueDate: string;
  amountOriginal: number;
  amountUSD: number;
}

/**
 * Spread an amount over dated instalments.
 *
 * The last instalment absorbs the rounding remainder. Dividing $100 into three
 * and rounding each to cents gives $99.99, and an invoice that can never reach
 * paid — the customer settles every instalment and still owes a cent forever.
 * Putting the difference on the final instalment is both correct and the
 * convention customers expect.
 *
 * Monthly uses a flat 30 days rather than calendar months, matching how
 * `duration` and every expiry date in this system already work.
 */
export function generateInstallmentSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const count = Math.trunc(asNumber(input.count));
  if (count < 1) throw new Error("عدد الأقساط يجب أن يكون واحداً على الأقل");
  if (count > MAX_INSTALLMENTS) throw new Error(`عدد الأقساط يتجاوز الحد المسموح (${MAX_INSTALLMENTS})`);

  const rate = input.exchangeRate > 0 ? input.exchangeRate : 1;
  const financed = Math.max(
    0,
    asNumber(input.totalOriginal) - Math.max(0, asNumber(input.downPaymentOriginal))
  );
  if (!(financed > 0)) throw new Error("لا يوجد مبلغ متبقٍ لتقسيطه");

  if (input.frequency === "custom") {
    const dates = input.customDates ?? [];
    if (dates.length !== count) {
      throw new Error("عدد التواريخ المخصصة لا يطابق عدد الأقساط");
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const per = round2(financed / count);

  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1;
    const amountOriginal = isLast ? round2(financed - per * (count - 1)) : per;
    const dueDate =
      input.frequency === "custom"
        ? (input.customDates as string[])[i]
        : addDays(input.firstDueDate, FREQUENCY_DAYS[input.frequency] * i);

    return {
      installmentNumber: i + 1,
      dueDate,
      amountOriginal,
      amountUSD: amountOriginal / rate,
    };
  });
}

// ─── Instalment status ────────────────────────────────────────────────────────

export function deriveInstallmentStatus(
  installment: Pick<Installment, "amountUSD" | "paidUSD" | "dueDate" | "status">,
  today: string
): InstallmentStatus {
  // Terminal states set by a human are never recomputed from dates.
  if (installment.status === "waived" || installment.status === "cancelled") return installment.status;

  const amount = asNumber(installment.amountUSD);
  const paid   = asNumber(installment.paidUSD);

  if (paid >= amount - OVERPAY_TOLERANCE_USD && amount > 0) return "paid";
  if (parseDateUTC(installment.dueDate) < parseDateUTC(today)) return "overdue";
  return paid > 0 ? "partially_paid" : "pending";
}

// ─── Payment allocation ───────────────────────────────────────────────────────

export interface AllocatableInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountUSD: number;
  paidUSD: number;
  status: InstallmentStatus;
}

export interface Allocation {
  installmentId: string;
  installmentNumber: number;
  appliedUSD: number;
  /** Paid total after this allocation. */
  paidUSD: number;
  remainingUSD: number;
  status: InstallmentStatus;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Money left over after every open instalment is settled. */
  unallocatedUSD: number;
}

/**
 * Apply a payment across a schedule, oldest due date first.
 *
 * A payment that covers more than one instalment is spread rather than
 * rejected: customers routinely pay two months at once, and refusing that in
 * the name of tidiness means the money gets recorded as an unallocated lump and
 * the schedule stops reflecting reality.
 *
 * `targetInstallmentId` puts one instalment at the front of the queue — the
 * case where a customer pays a specific later instalment early — and the
 * remainder still flows oldest-first from there.
 *
 * Instalments already paid, waived or cancelled are skipped. Whatever is left
 * after everything open is settled comes back as `unallocatedUSD`; the caller
 * decides whether that is an overpayment to reject or credit sitting on the
 * account.
 */
export function allocatePaymentToInstallments(
  amountUSD: number,
  installments: AllocatableInstallment[],
  targetInstallmentId?: string | null
): AllocationResult {
  let left = asNumber(amountUSD);
  if (!(left > 0)) return { allocations: [], unallocatedUSD: 0 };

  const open = installments
    .filter((i) => i.status !== "paid" && i.status !== "waived" && i.status !== "cancelled")
    .sort((a, b) => {
      if (targetInstallmentId) {
        if (a.id === targetInstallmentId) return -1;
        if (b.id === targetInstallmentId) return 1;
      }
      const byDate = parseDateUTC(a.dueDate) - parseDateUTC(b.dueDate);
      return byDate !== 0 ? byDate : a.installmentNumber - b.installmentNumber;
    });

  const allocations: Allocation[] = [];

  for (const inst of open) {
    if (left <= OVERPAY_TOLERANCE_USD) break;

    const owed = Math.max(0, asNumber(inst.amountUSD) - asNumber(inst.paidUSD));
    if (owed <= 0) continue;

    const applied = Math.min(owed, left);
    left -= applied;

    const paidUSD = asNumber(inst.paidUSD) + applied;
    const remainingUSD = Math.max(0, asNumber(inst.amountUSD) - paidUSD);

    allocations.push({
      installmentId:     inst.id,
      installmentNumber: inst.installmentNumber,
      appliedUSD:        applied,
      paidUSD,
      remainingUSD,
      status: remainingUSD <= OVERPAY_TOLERANCE_USD ? "paid" : "partially_paid",
    });
  }

  return { allocations, unallocatedUSD: Math.max(0, left) };
}

// ─── AR aging ─────────────────────────────────────────────────────────────────

export type AgingBucket = "not_due" | "due_today" | "d1_7" | "d8_30" | "d31_plus";

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  not_due:   "غير مستحق بعد",
  due_today: "مستحق اليوم",
  d1_7:      "متأخر ١–٧ أيام",
  d8_30:     "متأخر ٨–٣٠ يوماً",
  d31_plus:  "متأخر أكثر من ٣٠ يوماً",
};

export function agingBucketFor(dueDate: string, today: string): AgingBucket {
  const overdueDays = Math.floor((parseDateUTC(today) - parseDateUTC(dueDate)) / 86_400_000);
  if (overdueDays < 0)  return "not_due";
  if (overdueDays === 0) return "due_today";
  if (overdueDays <= 7)  return "d1_7";
  if (overdueDays <= 30) return "d8_30";
  return "d31_plus";
}

export type AgingSummary = Record<AgingBucket, { count: number; amountUSD: number }>;

/** Outstanding instalment balances grouped by how late they are. */
export function summarizeAging(
  installments: Pick<Installment, "dueDate" | "amountUSD" | "paidUSD" | "status">[],
  today: string
): AgingSummary {
  const empty: AgingSummary = {
    not_due:   { count: 0, amountUSD: 0 },
    due_today: { count: 0, amountUSD: 0 },
    d1_7:      { count: 0, amountUSD: 0 },
    d8_30:     { count: 0, amountUSD: 0 },
    d31_plus:  { count: 0, amountUSD: 0 },
  };

  for (const inst of installments) {
    if (inst.status === "paid" || inst.status === "waived" || inst.status === "cancelled") continue;
    const outstanding = Math.max(0, asNumber(inst.amountUSD) - asNumber(inst.paidUSD));
    if (outstanding <= OVERPAY_TOLERANCE_USD) continue;

    const bucket = empty[agingBucketFor(inst.dueDate, today)];
    bucket.count += 1;
    bucket.amountUSD += outstanding;
  }

  return empty;
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

/**
 * The receipt state of a payment, including ones written before the field
 * existed.
 *
 * A pre-ledger payment with a `receiptUrl` is reported as `pending_review`
 * rather than `verified`: nobody checked it, and marking thousands of historical
 * uploads as verified would make the word mean nothing on the day someone
 * actually starts checking them.
 */
export function resolveReceiptStatus(payment: {
  receiptStatus?: string | null;
  receiptUrl?: string | null;
}): ReceiptStatus {
  const s = payment.receiptStatus;
  if (s === "missing" || s === "pending_review" || s === "verified" || s === "rejected") return s;
  return payment.receiptUrl ? "pending_review" : "missing";
}

// ─── Invoice numbering ────────────────────────────────────────────────────────

/**
 * `INV-<year>-<6-digit sequence>`.
 *
 * The sequence is per-year and comes from a counter document rather than from
 * counting existing invoices: counting races under concurrent writes and would
 * hand two invoices the same number, which is the one thing an invoice number
 * must never do.
 */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(6, "0")}`;
}

// ─── Plan summary ─────────────────────────────────────────────────────────────

export interface PlanSummary {
  planType: PaymentPlanType;
  totalUSD: number;
  paidNowUSD: number;
  financedUSD: number;
  installmentCount: number;
  firstDueDate: string | null;
  lastDueDate: string | null;
}

/** What the operator is about to commit to, for the preview before saving. */
export function summarizePlan(
  totalUSD: number,
  paidNowUSD: number,
  schedule: ScheduledInstallment[]
): PlanSummary {
  return {
    planType:         schedule.length > 0 ? "installments" : "full",
    totalUSD,
    paidNowUSD,
    financedUSD:      schedule.reduce((sum, s) => sum + s.amountUSD, 0),
    installmentCount: schedule.length,
    firstDueDate:     schedule[0]?.dueDate ?? null,
    lastDueDate:      schedule[schedule.length - 1]?.dueDate ?? null,
  };
}

/**
 * The ids of subscribers that have been soft-deleted.
 *
 * Soft delete is the project's only delete: the document stays, flagged. That
 * is deliberate — historical links must not break — but it means every reader
 * has to opt out of them explicitly, and a reader that forgets shows numbers
 * for people the rest of the app says do not exist.
 */
export function deletedSubscriberIds(subscribers: { id: string; deleted?: boolean }[]): Set<string> {
  return new Set(subscribers.filter((s) => s.deleted === true).map((s) => s.id));
}

/**
 * Drops ledger rows belonging to soft-deleted subscribers.
 *
 * Rows carrying no `subscriberId` are kept: they cannot be attributed either
 * way, and dropping them would understate the totals rather than correct them.
 */
export function omitDeletedSubscriberRows<R extends { subscriberId?: string }>(
  rows: R[],
  deletedIds: Set<string>,
): R[] {
  return rows.filter((r) => !r.subscriberId || !deletedIds.has(r.subscriberId));
}

// ─── Who counts as a customer ────────────────────────────────────────────────
//
// Two questions, two answers, two names. Before this the app asked "how many
// active?" in three places and got three numbers — 44 on the analytics page, 8
// on the dashboard, a third on the teams page — because each screen rewrote the
// rule inline. The owner could not tell whether the business had 44 customers
// or 8.
//
// The deeper mistake was using a DISPLAY STATUS as a BUSINESS METRIC.
// getComputedStatus() returns an exclusive partition for badges — منسحب /
// متجمد / موقوف / منتهي / ينتهي قريباً / نشط — so a subscriber with five days
// left is labelled "ينتهي قريباً" and was therefore excluded from the "active"
// count. But they are paying, their subscription is valid, and they are exactly
// the person the team should be calling. Expiring soon is an urgency flag on an
// active subscription, not a state beside it.

interface LifecycleFields {
  subscriptionState?: string;
  subscriptionStatus?: string;
  daysRemaining?: number;
  freezeData?: { isFrozen?: boolean };
}

/** Withdrawn: they left. Never counts anywhere. */
function hasWithdrawn(s: LifecycleFields): boolean {
  return s.subscriptionState === "withdrawn";
}

/**
 * Frozen is written two ways in this codebase — `subscriptionStatus === "frozen"`
 * and `freezeData.isFrozen` — and different screens checked different ones.
 * Both are honoured here so the answer cannot depend on which one a record uses.
 */
function isOnHold(s: LifecycleFields): boolean {
  return (
    s.subscriptionStatus === "paused" ||
    s.subscriptionStatus === "frozen" ||
    s.freezeData?.isFrozen === true
  );
}

/**
 * "نشط الآن" — a subscription that is valid today: not withdrawn, not paused or
 * frozen, and not past its expiry. Someone expiring in three days is included.
 *
 * This is the number that answers "how many people are we serving right now".
 */
export function isActiveNow(s: LifecycleFields): boolean {
  return !hasWithdrawn(s) && !isOnHold(s) && (s.daysRemaining ?? -1) >= 0;
}

/**
 * "قاعدة العملاء" — everyone who has not withdrawn, expired subscriptions
 * included.
 *
 * This is the renewable population, and it is a legitimately different question
 * from isActiveNow: an expired subscriber is not being served today but is very
 * much still a customer to win back. Both numbers are useful; naming them the
 * same thing was the bug.
 */
export function isInCustomerBase(s: LifecycleFields): boolean {
  return !hasWithdrawn(s);
}

/** Active today AND within `days` of expiry — the renewal call list. */
export function isExpiringWithin(s: LifecycleFields, days: number): boolean {
  return isActiveNow(s) && (s.daysRemaining ?? -1) <= days;
}
