/**
 * Writing the billing ledger, inside the transactions that already exist.
 *
 * Every function here takes a Firestore `Transaction` and stages writes on it.
 * Nothing commits, nothing reads outside the transaction, and nothing throws on
 * a ledger problem that should not fail the operation — because the contract
 * with the rest of the system is strict:
 *
 *   **The legacy summary fields on `subscribers` remain the source of truth.**
 *
 * They are written exactly as before, by the same arithmetic, in the same
 * transaction. The cycle, invoice and instalment documents are an additional
 * ledger written alongside them. If the ledger were the authority instead,
 * every subscriber created before it existed would read as $0 paid — and the
 * migration would have to be mandatory, which the brief rules out.
 *
 * Read order matters in Firestore transactions: every read must precede every
 * write. The callers already do their reads up front, so these functions take
 * whatever they need as plain values and only stage writes.
 */

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { MAX_INSTALLMENTS } from "@/constants/billing";
import { asNumber, asString, OVERPAY_TOLERANCE_USD } from "@/lib/subscriberFinance";
import {
  allocatePaymentToInstallments,
  deriveBillingStatus,
  deriveInstallmentStatus,
  formatInvoiceNumber,
  type AllocatableInstallment,
  type Allocation,
  type ScheduledInstallment,
} from "@/lib/subscriberLifecycle";
import type {
  CycleStatus,
  InstallmentFrequency,
  PaymentPlanType,
} from "@/types/billing";

export const CYCLES      = "subscriptionCycles";
export const INVOICES    = "invoices";
export const INSTALLMENTS = "installments";
export const COUNTERS    = "counters";
export const ADJUSTMENTS = "paymentAdjustments";
export const SETTLEMENT_BATCHES = "settlementBatches";

// MAX_INSTALLMENTS lives in constants/billing.ts so the Zod schema, the pure
// schedule generator and this transaction all read the same number.
export { MAX_INSTALLMENTS };

/** Firestore's hard cap on writes in one transaction. */
const TRANSACTION_WRITE_LIMIT = 500;

/** Non-instalment writes the heaviest operation stages. Kept generous. */
const FIXED_WRITE_BUDGET = 12;

function assertWriteBudget(installmentCount: number): void {
  if (installmentCount > MAX_INSTALLMENTS) {
    throw new Error(`عدد الأقساط يتجاوز الحد المسموح (${MAX_INSTALLMENTS})`);
  }
  if (installmentCount + FIXED_WRITE_BUDGET > TRANSACTION_WRITE_LIMIT) {
    // Unreachable while MAX_INSTALLMENTS holds; here so raising the cap without
    // rethinking atomicity fails in tests instead of at 3am in production.
    throw new Error(
      `Transaction write budget exceeded: ${installmentCount} instalments + ${FIXED_WRITE_BUDGET} fixed writes ` +
      `> ${TRANSACTION_WRITE_LIMIT}. Split the instalment writes out of the transaction before raising MAX_INSTALLMENTS.`
    );
  }
}

// ─── Invoice numbering ────────────────────────────────────────────────────────

/**
 * Reserve the next invoice number for a year.
 *
 * Must be called inside the transaction, before any write, so two concurrent
 * signups cannot be handed the same number. Counting existing invoices instead
 * — the obvious shortcut — races exactly here, and a duplicate invoice number
 * is the one defect an invoice sequence must not have.
 */
export async function reserveInvoiceNumber(
  tx: Transaction,
  db: Firestore,
  year: number
): Promise<{ invoiceNumber: string; commit: () => void }> {
  const ref = db.collection(COUNTERS).doc(`invoices-${year}`);
  const snap = await tx.get(ref);
  const next = asNumber(snap.data()?.sequence) + 1;

  return {
    invoiceNumber: formatInvoiceNumber(year, next),
    commit: () => tx.set(ref, { sequence: next, year, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
  };
}

// ─── Cycle ────────────────────────────────────────────────────────────────────

export interface CycleInput {
  subscriberId: string;
  subscriberName: string;
  convincedByUid?: string | null;
  cycleNumber: number;
  package: string;
  duration: number;
  startDate: string;
  expiryDate: string;
  currencyOriginal: string;
  listPriceOriginal: number;
  discountOriginal: number;
  totalPriceOriginal: number;
  exchangeRate: number;
  totalPriceUSD: number;
  paidAmountUSD: number;
  refundAmountUSD?: number;
  status?: CycleStatus;
  actorUid: string;
}

/** Stage a new cycle document. Returns its id so the caller can link to it. */
export function stageCycle(
  tx: Transaction,
  db: Firestore,
  input: CycleInput
): { cycleId: string; ref: FirebaseFirestore.DocumentReference } {
  const ref = db.collection(CYCLES).doc();
  const refunded  = Math.max(0, asNumber(input.refundAmountUSD));
  const remaining = Math.max(0, input.totalPriceUSD - input.paidAmountUSD);

  tx.set(ref, {
    subscriberId:   input.subscriberId,
    subscriberName: input.subscriberName,
    // Denormalised for firestore.rules — without it every cycle is staff-only
    // and the employee who owns the subscriber cannot read their own billing.
    ...(input.convincedByUid ? { convincedByUid: input.convincedByUid } : {}),
    cycleNumber:        input.cycleNumber,
    package:            input.package,
    duration:           input.duration,
    startDate:          input.startDate,
    expiryDate:         input.expiryDate,
    status:             input.status ?? "active",
    currencyOriginal:   input.currencyOriginal,
    listPriceOriginal:  input.listPriceOriginal,
    discountOriginal:   input.discountOriginal,
    totalPriceOriginal: input.totalPriceOriginal,
    exchangeRate:       input.exchangeRate,
    totalPriceUSD:      input.totalPriceUSD,
    paidAmountUSD:      input.paidAmountUSD,
    remainingAmountUSD: remaining,
    refundAmountUSD:    refunded,
    netAmountUSD:       Math.max(0, input.paidAmountUSD - refunded),
    invoiceId:          null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.actorUid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: input.actorUid,
  });

  return { cycleId: ref.id, ref };
}

/** Close the outgoing cycle when a renewal starts a new one. */
export function stageCloseCycle(
  tx: Transaction,
  db: Firestore,
  cycleId: string,
  status: CycleStatus,
  actorUid: string,
  reason: string
): void {
  tx.set(
    db.collection(CYCLES).doc(cycleId),
    {
      status,
      closedAt:     FieldValue.serverTimestamp(),
      closedReason: reason,
      updatedAt:    FieldValue.serverTimestamp(),
      updatedBy:    actorUid,
    },
    { merge: true }
  );
}

// ─── Invoice + instalments ────────────────────────────────────────────────────

export interface InvoiceInput {
  invoiceNumber: string;
  subscriberId: string;
  subscriberName: string;
  convincedByUid?: string | null;
  cycleId: string;
  cycleNumber: number;
  issueDate: string;
  dueDate: string;
  currencyOriginal: string;
  subtotalOriginal: number;
  discountOriginal: number;
  totalOriginal: number;
  exchangeRate: number;
  totalUSD: number;
  paidUSD: number;
  planType: PaymentPlanType;
  schedule: ScheduledInstallment[];
  notes?: string | null;
  actorUid: string;
  today: string;
}

export interface StagedInvoice {
  invoiceId: string;
  installmentIds: string[];
  status: string;
}

/**
 * Stage an invoice and, when the plan is instalments, its schedule.
 *
 * The down payment is applied to the schedule immediately rather than left
 * floating: a customer who pays a third up front should see instalment #1
 * settled, not three pending instalments and an unexplained credit.
 */
export function stageInvoice(
  tx: Transaction,
  db: Firestore,
  input: InvoiceInput
): StagedInvoice {
  assertWriteBudget(input.schedule.length);

  const invoiceRef = db.collection(INVOICES).doc();
  const linkFields = input.convincedByUid ? { convincedByUid: input.convincedByUid } : {};

  const installmentIds: string[] = [];

  if (input.schedule.length > 0) {
    const refs = input.schedule.map(() => db.collection(INSTALLMENTS).doc());

    /*
     * Instalments start unpaid, even when a down payment was taken.
     *
     * generateInstallmentSchedule() is always called with
     * `downPaymentOriginal` set, so the schedule already covers only what is
     * still owed — $300 with $100 down produces three instalments summing to
     * $200, not $300. Allocating the down payment on top of that spends it
     * twice: it is subtracted once to size the schedule and then applied again
     * to settle the first instalment.
     *
     * The E2E run that caught this showed the damage plainly — invoice
     * "remaining $200" beside instalments totalling $100 outstanding, so $100
     * had silently left the schedule. The invoice and its own instalments have
     * to describe the same debt, and they only do if the down payment touches
     * the invoice total alone.
     */
    input.schedule.forEach((s, i) => {
      const ref = refs[i];
      const paidUSD = 0;
      const remainingUSD = s.amountUSD;

      tx.set(ref, {
        invoiceId:      invoiceRef.id,
        subscriberId:   input.subscriberId,
        subscriberName: input.subscriberName,
        ...linkFields,
        cycleId:           input.cycleId,
        installmentNumber: s.installmentNumber,
        dueDate:           s.dueDate,
        amountOriginal:    s.amountOriginal,
        amountUSD:         s.amountUSD,
        paidUSD,
        remainingUSD,
        status: deriveInstallmentStatus(
          { amountUSD: s.amountUSD, paidUSD, dueDate: s.dueDate, status: "pending" },
          input.today
        ),
        paidAt:     remainingUSD <= OVERPAY_TOLERANCE_USD ? FieldValue.serverTimestamp() : null,
        paymentIds: [],
        notes:      null,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: input.actorUid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actorUid,
      });
      installmentIds.push(ref.id);
    });
  }

  const remainingUSD = Math.max(0, input.totalUSD - input.paidUSD);
  const status = deriveBillingStatus(
    { totalUSD: input.totalUSD, paidUSD: input.paidUSD, dueDate: input.dueDate },
    input.today
  );

  tx.set(invoiceRef, {
    invoiceNumber:  input.invoiceNumber,
    subscriberId:   input.subscriberId,
    subscriberName: input.subscriberName,
    ...linkFields,
    cycleId:     input.cycleId,
    cycleNumber: input.cycleNumber,
    issueDate:   input.issueDate,
    dueDate:     input.dueDate,
    currencyOriginal: input.currencyOriginal,
    subtotalOriginal: input.subtotalOriginal,
    discountOriginal: input.discountOriginal,
    totalOriginal:    input.totalOriginal,
    exchangeRate:     input.exchangeRate,
    totalUSD:     input.totalUSD,
    paidUSD:      input.paidUSD,
    remainingUSD,
    refundedUSD:  0,
    status,
    paymentPlanType:  input.planType,
    installmentCount: input.schedule.length,
    notes: input.notes ?? null,
    voidedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.actorUid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: input.actorUid,
  });

  // Link the cycle back to its invoice.
  tx.set(
    db.collection(CYCLES).doc(input.cycleId),
    { invoiceId: invoiceRef.id, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { invoiceId: invoiceRef.id, installmentIds, status };
}

// ─── Applying a payment to the ledger ─────────────────────────────────────────

export interface OpenInvoice {
  id: string;
  totalUSD: number;
  paidUSD: number;
  refundedUSD: number;
  dueDate: string;
  cycleId: string;
  cycleNumber: number;
}

export interface LedgerPaymentResult {
  invoiceId: string | null;
  cycleId: string | null;
  cycleNumber: number | null;
  allocations: Allocation[];
  unallocatedUSD: number;
  invoiceStatus: string | null;
}

/**
 * Roll a payment through instalments → invoice → cycle.
 *
 * Deliberately tolerant of a missing ledger: a subscriber with no invoice —
 * every one created before this shipped — gets `invoiceId: null` back and the
 * caller carries on updating the legacy summary fields exactly as it always
 * has. The payment is never rejected for want of an invoice.
 *
 * A payment against a *scheduled* invoice must land on an instalment. If any
 * money is left over after every open instalment is settled, this throws rather
 * than writing a payment that belongs nowhere.
 *
 * The subscriber-level guard in computePaymentUpdate() does not cover this. It
 * compares against `subscribers.totalPriceUSD`, which can legitimately exceed
 * the sum of open instalments — after a waiver, a cancelled instalment, or a
 * price raised on the subscriber without extending the schedule. In those cases
 * the old code let the payment through and the surplus simply evaporated: the
 * balance moved, no instalment changed, and the schedule silently stopped
 * describing the money. Refusing is the honest answer; the operator either fixes
 * the schedule or records the surplus deliberately.
 *
 * An invoice with **no** schedule (`paymentPlanType: "full"`) is unaffected —
 * there is nothing to allocate to, the whole amount lands on the invoice, and
 * `unallocatedUSD` is returned for information only.
 */
export function stageLedgerPayment(
  tx: Transaction,
  db: Firestore,
  input: {
    paymentId: string;
    amountUSD: number;
    invoice: OpenInvoice | null;
    installments: AllocatableInstallment[];
    targetInstallmentId?: string | null;
    actorUid: string;
    today: string;
  }
): LedgerPaymentResult {
  if (!input.invoice) {
    return {
      invoiceId: null, cycleId: null, cycleNumber: null,
      allocations: [], unallocatedUSD: input.amountUSD, invoiceStatus: null,
    };
  }

  const { allocations, unallocatedUSD } = allocatePaymentToInstallments(
    input.amountUSD,
    input.installments,
    input.targetInstallmentId
  );

  if (input.installments.length > 0 && unallocatedUSD > OVERPAY_TOLERANCE_USD) {
    const open = input.installments.filter(
      (i) => i.status !== "paid" && i.status !== "waived" && i.status !== "cancelled"
    );
    throw new Error(
      open.length === 0
        ? "لا يوجد قسط مفتوح لتنزيل هذه الدفعة عليه — راجع جدول الأقساط أولاً"
        : `المبلغ يتجاوز الأقساط المستحقة بمقدار $${unallocatedUSD.toFixed(2)} — عدّل المبلغ أو أضف قسطاً`
    );
  }

  for (const alloc of allocations) {
    tx.set(
      db.collection(INSTALLMENTS).doc(alloc.installmentId),
      {
        paidUSD:      alloc.paidUSD,
        remainingUSD: alloc.remainingUSD,
        status:       alloc.status,
        paidAt:       alloc.status === "paid" ? FieldValue.serverTimestamp() : null,
        paymentIds:   FieldValue.arrayUnion(input.paymentId),
        updatedAt:    FieldValue.serverTimestamp(),
        updatedBy:    input.actorUid,
      },
      { merge: true }
    );
  }

  const invoicePaid = input.invoice.paidUSD + input.amountUSD;
  const invoiceStatus = deriveBillingStatus(
    {
      totalUSD:    input.invoice.totalUSD,
      paidUSD:     invoicePaid,
      refundedUSD: input.invoice.refundedUSD,
      dueDate:     input.invoice.dueDate,
    },
    input.today
  );

  tx.set(
    db.collection(INVOICES).doc(input.invoice.id),
    {
      paidUSD:      invoicePaid,
      remainingUSD: Math.max(0, input.invoice.totalUSD - invoicePaid),
      status:       invoiceStatus,
      updatedAt:    FieldValue.serverTimestamp(),
      updatedBy:    input.actorUid,
    },
    { merge: true }
  );

  if (input.invoice.cycleId) {
    tx.set(
      db.collection(CYCLES).doc(input.invoice.cycleId),
      {
        paidAmountUSD:      invoicePaid,
        remainingAmountUSD: Math.max(0, input.invoice.totalUSD - invoicePaid),
        netAmountUSD:       Math.max(0, invoicePaid - input.invoice.refundedUSD),
        updatedAt:          FieldValue.serverTimestamp(),
        updatedBy:          input.actorUid,
      },
      { merge: true }
    );
  }

  return {
    invoiceId:   input.invoice.id,
    cycleId:     input.invoice.cycleId,
    cycleNumber: input.invoice.cycleNumber,
    allocations,
    unallocatedUSD,
    invoiceStatus,
  };
}

/** Record a refund against the cycle and its invoice. */
export function stageLedgerRefund(
  tx: Transaction,
  db: Firestore,
  input: {
    invoice: OpenInvoice | null;
    cycleId: string | null;
    refundUSD: number;
    actorUid: string;
    today: string;
  }
): void {
  if (input.invoice) {
    const refunded = input.invoice.refundedUSD + input.refundUSD;
    tx.set(
      db.collection(INVOICES).doc(input.invoice.id),
      {
        refundedUSD: refunded,
        status: deriveBillingStatus(
          {
            totalUSD:    input.invoice.totalUSD,
            paidUSD:     input.invoice.paidUSD,
            refundedUSD: refunded,
            dueDate:     input.invoice.dueDate,
          },
          input.today
        ),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actorUid,
      },
      { merge: true }
    );
  }

  if (input.cycleId) {
    tx.set(
      db.collection(CYCLES).doc(input.cycleId),
      {
        refundAmountUSD: FieldValue.increment(input.refundUSD),
        updatedAt:       FieldValue.serverTimestamp(),
        updatedBy:       input.actorUid,
      },
      { merge: true }
    );
  }
}

/**
 * Apply a signed adjustment to the invoice and cycle.
 *
 * Symmetrical with stageLedgerPayment but never touches instalments. An
 * adjustment corrects a total, not a schedule: writing off $40 does not settle
 * instalment #3, and pretending it did would report a customer as having paid
 * money nobody received. The instalment stays open and visibly unpaid; the
 * invoice total it belongs to is what moves.
 */
export function stageLedgerAdjustment(
  tx: Transaction,
  db: Firestore,
  input: {
    invoice: OpenInvoice | null;
    cycleId: string | null;
    /** Signed: negative reduces what was collected. */
    amountUSD: number;
    actorUid: string;
    today: string;
  }
): { invoiceStatus: string | null } {
  if (!input.invoice) {
    if (input.cycleId) {
      tx.set(
        db.collection(CYCLES).doc(input.cycleId),
        {
          paidAmountUSD: FieldValue.increment(input.amountUSD),
          netAmountUSD:  FieldValue.increment(input.amountUSD),
          updatedAt:     FieldValue.serverTimestamp(),
          updatedBy:     input.actorUid,
        },
        { merge: true }
      );
    }
    return { invoiceStatus: null };
  }

  const paid = Math.max(0, input.invoice.paidUSD + input.amountUSD);
  const status = deriveBillingStatus(
    {
      totalUSD:    input.invoice.totalUSD,
      paidUSD:     paid,
      refundedUSD: input.invoice.refundedUSD,
      dueDate:     input.invoice.dueDate,
    },
    input.today
  );

  tx.set(
    db.collection(INVOICES).doc(input.invoice.id),
    {
      paidUSD:      paid,
      remainingUSD: Math.max(0, input.invoice.totalUSD - paid),
      status,
      updatedAt:    FieldValue.serverTimestamp(),
      updatedBy:    input.actorUid,
    },
    { merge: true }
  );

  if (input.cycleId) {
    tx.set(
      db.collection(CYCLES).doc(input.cycleId),
      {
        paidAmountUSD:      paid,
        remainingAmountUSD: Math.max(0, input.invoice.totalUSD - paid),
        netAmountUSD:       Math.max(0, paid - input.invoice.refundedUSD),
        updatedAt:          FieldValue.serverTimestamp(),
        updatedBy:          input.actorUid,
      },
      { merge: true }
    );
  }

  return { invoiceStatus: status };
}

/** Move a cycle to a new operational status (freeze, pause, withdraw, resume). */
export function stageCycleStatus(
  tx: Transaction,
  db: Firestore,
  cycleId: string | null,
  status: CycleStatus,
  actorUid: string,
  patch: Record<string, unknown> = {}
): void {
  if (!cycleId) return;
  tx.set(
    db.collection(CYCLES).doc(cycleId),
    { status, ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid },
    { merge: true }
  );
}

// ─── Reads (outside a transaction, or staged before writes) ───────────────────

/**
 * The subscriber's current invoice and its open instalments.
 *
 * Returns nulls rather than throwing when the subscriber has no ledger — the
 * common case for existing records, and not an error.
 *
 * The instalment query filters by `invoiceId` alone and sorts in memory:
 * ordering by `dueDate` in Firestore would need a composite index, and a query
 * whose index has not been deployed fails at runtime, which here would mean a
 * payment silently allocating to nothing.
 */
export async function readOpenLedger(
  tx: Transaction,
  db: Firestore,
  subscriberId: string,
  currentCycleId: string | null | undefined
): Promise<{ invoice: OpenInvoice | null; installments: AllocatableInstallment[] }> {
  if (!currentCycleId) return { invoice: null, installments: [] };

  const cycleSnap = await tx.get(db.collection(CYCLES).doc(currentCycleId));
  const invoiceId = asString(cycleSnap.data()?.invoiceId);
  if (!cycleSnap.exists || !invoiceId) return { invoice: null, installments: [] };

  const invoiceSnap = await tx.get(db.collection(INVOICES).doc(invoiceId));
  if (!invoiceSnap.exists) return { invoice: null, installments: [] };
  const inv = invoiceSnap.data() ?? {};

  // A voided invoice takes no more money; the caller falls back to the legacy
  // balance rather than writing to a document that is out of circulation.
  if (asString(inv.status) === "void") return { invoice: null, installments: [] };

  const instSnap = await tx.get(
    db.collection(INSTALLMENTS).where("invoiceId", "==", invoiceId)
  );

  const installments: AllocatableInstallment[] = instSnap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        installmentNumber: asNumber(x.installmentNumber),
        dueDate:   asString(x.dueDate),
        amountUSD: asNumber(x.amountUSD),
        paidUSD:   asNumber(x.paidUSD),
        status:    asString(x.status, "pending") as AllocatableInstallment["status"],
      };
    })
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  return {
    invoice: {
      id:          invoiceSnap.id,
      totalUSD:    asNumber(inv.totalUSD),
      paidUSD:     asNumber(inv.paidUSD),
      refundedUSD: asNumber(inv.refundedUSD),
      dueDate:     asString(inv.dueDate),
      cycleId:     currentCycleId,
      cycleNumber: asNumber(inv.cycleNumber, 1),
    },
    installments,
  };
}

/** Frequency-safe cast for payload values arriving from the client. */
export function asFrequency(value: unknown): InstallmentFrequency {
  return value === "weekly" || value === "biweekly" || value === "monthly" || value === "custom"
    ? value
    : "monthly";
}

export { Timestamp };
export const COLLECTION_NAMES = { CYCLES, INVOICES, INSTALLMENTS, SUBSCRIBERS: COLLECTIONS.SUBSCRIBERS };
