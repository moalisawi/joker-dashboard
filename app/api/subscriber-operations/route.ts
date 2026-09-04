import { NextResponse } from "next/server";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { createServerNotification } from "@/lib/serverNotification";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  canMutateSubscriber,
  type SubscriberAction,
  type SubscriberLinkFields,
} from "@/lib/serverSubscriberAccess";
import {
  addDays,
  asNumber,
  asString,
  computePaymentUpdate,
  computeRenewalTotals,
  computeResumeExpiry,
  computeWithdrawalRefund,
  daysUsed,
  elapsedDaysSince,
  normalizeExchangeRate,
  remainingDays,
  resolveRenewalWindow,
} from "@/lib/subscriberFinance";
import {
  generateInstallmentSchedule,
  type ScheduledInstallment,
} from "@/lib/subscriberLifecycle";
import {
  asFrequency,
  readOpenLedger,
  reserveInvoiceNumber,
  stageCloseCycle,
  stageCycle,
  stageCycleStatus,
  stageInvoice,
  stageLedgerPayment,
  stageLedgerRefund,
  stageLedgerAdjustment,
  ADJUSTMENTS,
} from "@/lib/serverBillingLedger";
import {
  ADJUSTMENT_APPROVAL_THRESHOLD_USD,
  ADJUSTMENT_TYPES,
  MAX_INSTALLMENTS,
} from "@/constants/billing";
import {
  CREATE_WRITABLE_SUBSCRIBER_FIELDS,
  UPDATE_WRITABLE_SUBSCRIBER_FIELDS,
} from "@/constants/subscriberFieldPolicy";
import {
  findImmutableViolations,
  immutableRefusalMessage,
  pickWritable,
} from "@/lib/subscriberWriteGuard";
import { currencySchema, dateSchema, subscriberCoreSchema } from "@/lib/subscriberWriteSchema";
import { z } from "zod";

export const runtime = "nodejs";

// ── Zod schemas for each operation payload ────────────────────────────────────

const subscriberIdSchema = z.string().min(1, "subscriberId is required");
const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().min(0);


/**
 * How the subscription will be paid for.
 *
 * Absent means "full" — every caller that predates instalments keeps working
 * unchanged, and the invoice is simply issued with no schedule behind it.
 */
const paymentPlanSchema = z.object({
  type:             z.enum(["full", "installments"]).optional(),
  installmentCount: z.number().int().min(1).max(MAX_INSTALLMENTS).optional(),
  firstDueDate:     dateSchema,
  frequency:        z.enum(["weekly", "biweekly", "monthly", "custom"]).optional(),
  customDates:      z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(MAX_INSTALLMENTS).optional(),
  /** When the whole amount is due, for a non-instalment plan. */
  dueDate:          dateSchema,
}).optional().nullable();

const receiptFieldsSchema = {
  receiptUrl:        z.string().url().optional().nullable(),
  receiptFileName:   z.string().max(300).optional().nullable(),
  externalReference: z.string().max(200).optional().nullable(),
};

const createSubscriberSchema = z.object({
  subscriber: subscriberCoreSchema,
  initialPayment: z.object({
    amountOriginal:   nonNegativeNumber.optional(),
    currencyOriginal: currencySchema.optional(),
    exchangeRate:     z.number().positive().optional(),
    paymentMethod:    z.string().max(100).optional(),
    paymentMethodId:  z.string().max(100).optional(),
    date:             dateSchema,
    notes:            z.string().max(2000).optional().nullable(),
    ...receiptFieldsSchema,
  }).optional().nullable(),
  paymentPlan: paymentPlanSchema,
});

// Explicit allowed fields for updates — prevents mass-assignment of arbitrary fields.
const updateSubscriberSchema = z.object({
  subscriberId: subscriberIdSchema,
  subscriber:   subscriberCoreSchema.partial(),
});

const deleteSubscriberSchema = z.object({
  subscriberId:   subscriberIdSchema,
  subscriberName: z.string().optional(),
});

const addPaymentSchema = z.object({
  subscriberId:     subscriberIdSchema,
  amountOriginal:   positiveNumber,
  currencyOriginal: currencySchema.optional(),
  exchangeRate:     z.number().positive().optional(),
  paymentMethod:    z.string().max(100).optional(),
  paymentMethodId:  z.string().max(100).optional(),
  date:             dateSchema,
  notes:            z.string().max(2000).optional().nullable(),
  /** Settle this instalment first; the remainder still flows oldest-first. */
  installmentId:    z.string().max(128).optional().nullable(),
  ...receiptFieldsSchema,
});

/**
 * Correct money already recorded, without editing the record.
 *
 * `amountUSD` is signed and required: negative takes money off the balance
 * (a mis-keyed payment, a late discount, a write-off), positive puts it back.
 * A reason is mandatory — an adjustment with no stated reason is an unexplained
 * edit wearing a different name.
 */
const adjustPaymentSchema = z.object({
  subscriberId:   subscriberIdSchema,
  paymentId:      z.string().max(128).optional().nullable(),
  adjustmentType: z.enum(ADJUSTMENT_TYPES),
  amountUSD:      z.number().refine((n) => n !== 0 && Number.isFinite(n), "المبلغ مطلوب ولا يمكن أن يكون صفراً"),
  currencyOriginal: currencySchema.optional(),
  exchangeRate:   z.number().positive().optional(),
  reason:         z.string().min(3, "سبب التسوية مطلوب").max(500),
  notes:          z.string().max(2000).optional().nullable(),
  date:           dateSchema,
  approvedByName: z.string().max(200).optional().nullable(),
});

/**
 * Verify or reject the proof attached to a payment.
 *
 * Separate from the money on purpose: this never changes `amountUSD` or any
 * balance. It records whether a human has looked at the transfer slip.
 */
const verifyReceiptSchema = z.object({
  paymentId: z.string().min(1),
  decision:  z.enum(["verify", "reject"]),
  reason:    z.string().max(500).optional().nullable(),
});

const renewSubscriptionSchema = z.object({
  subscriberId:  subscriberIdSchema,
  duration:      z.number().int().positive().default(30),
  currency:      currencySchema.optional(),
  totalPrice:    nonNegativeNumber.optional(),
  exchangeRate:  z.number().positive().optional(),
  paidAmount:    nonNegativeNumber.optional().nullable(),
  renewalDate:   dateSchema,
  paymentMethod: z.string().max(100).optional(),
  paymentMethodId: z.string().max(100).optional(),
  package:       z.string().max(200).optional(),
  notes:         z.string().max(2000).optional().nullable(),
  paymentPlan:   paymentPlanSchema,
  ...receiptFieldsSchema,
});

const withdrawSchema = z.object({
  subscriberId:    subscriberIdSchema,
  reason:          z.string().min(1, "Reason is required").max(500),
  refundAmount:    nonNegativeNumber.optional().default(0),
  refundCurrency:  currencySchema.optional(),
  exchangeRate:    z.number().positive().optional(),
  notes:           z.string().max(2000).optional().nullable(),
});

const pauseSchema = z.object({
  subscriberId: subscriberIdSchema,
  reason:       z.string().max(500).optional(),
  notes:        z.string().max(2000).optional().nullable(),
});

const freezeSchema = z.object({
  subscriberId: subscriberIdSchema,
  reason:       z.string().min(1, "Reason is required").max(500),
  notes:        z.string().max(2000).optional().nullable(),
});

const resumeSchema = z.object({
  subscriberId: subscriberIdSchema,
});

const OPERATION_SCHEMAS = {
  createSubscriber:        createSubscriberSchema,
  updateSubscriber:        updateSubscriberSchema,
  deleteSubscriber:        deleteSubscriberSchema,
  addPayment:              addPaymentSchema,
  renewSubscription:       renewSubscriptionSchema,
  withdrawSubscriber:      withdrawSchema,
  pauseSubscription:       pauseSchema,
  resumePausedSubscription: resumeSchema,
  freezeSubscription:      freezeSchema,
  resumeSubscription:      resumeSchema,
  verifyReceipt:           verifyReceiptSchema,
  adjustPayment:           adjustPaymentSchema,
} as const;

const VALID_OPERATIONS = new Set(Object.keys(OPERATION_SCHEMAS));

type Operation = keyof typeof OPERATION_SCHEMAS;

type OperationBody = {
  operation: Operation;
  payload?: Record<string, unknown>;
};

type ServerUser = Awaited<ReturnType<typeof verifyServerUser>>;

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Fields that may be set/updated by the client.
 *
 * Derived from `SUBSCRIBER_FIELD_POLICY`, never hand-written. The list used to
 * live here as a literal and had drifted from the schema above it: `residence`,
 * `phoneCountry`, `dialCode`, `phoneE164`, `referrer` and `sourceDetail` all
 * passed validation and were then dropped here, silently, on every signup. It
 * also named `status` and `subscriptionStatus`, which the schema does not accept
 * — entries that could never match anything.
 *
 * There are two sets because selling a subscription and editing a customer are
 * not the same act. One list served both, which is how an "edit customer"
 * dialog could reprice a subscription: price, exchange rate, duration, package
 * and expiry were all writable on a record that had already been invoiced.
 */

/** Creation may set the terms of the sale; nothing else may. */
function pickWritableFields(raw: Record<string, unknown>): Record<string, unknown> {
  return pickWritable(raw, CREATE_WRITABLE_SUBSCRIBER_FIELDS);
}

function actorName(user: NonNullable<ServerUser>) {
  return user.email || user.uid;
}

/**
 * Turn a payment-plan payload into a dated schedule.
 *
 * Returns an empty array for a full payment — the invoice is still issued, it
 * just has no instalments behind it — and throws only on a plan that asks for
 * instalments it cannot produce, so a bad plan is a 500 with a readable Arabic
 * message rather than a silently empty schedule.
 */
function buildSchedule(
  plan: Record<string, unknown>,
  money: { totalOriginal: number; downPaymentOriginal: number; exchangeRate: number },
  fallbackFirstDue: string
): ScheduledInstallment[] {
  if (asString(plan.type) !== "installments") return [];

  const count = asNumber(plan.installmentCount);
  if (count < 1) throw new Error("خطة الأقساط تحتاج عدد أقساط صحيح");

  const financed = money.totalOriginal - money.downPaymentOriginal;
  // Paying the whole thing up front while asking for instalments is not an
  // error worth rejecting a signup over — there is simply nothing left to
  // schedule, so the invoice behaves as a full payment.
  if (financed <= 0) return [];

  return generateInstallmentSchedule({
    totalOriginal:       money.totalOriginal,
    downPaymentOriginal: money.downPaymentOriginal,
    exchangeRate:        money.exchangeRate,
    count,
    firstDueDate:        asString(plan.firstDueDate, fallbackFirstDue),
    frequency:           asFrequency(plan.frequency),
    customDates:         Array.isArray(plan.customDates) ? (plan.customDates as string[]) : undefined,
  });
}

async function writeAudit(
  user: NonNullable<ServerUser>,
  action: string,
  details: {
    category?: string;
    severity?: string;
    entityType?: string;
    entityId?: string;
    entityName?: string;
    description?: string;
    financialData?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
    previousData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    changedFields?: string[];
  }
) {
  const db = getFirestore();
  const performer = {
    uid: user.uid,
    name: actorName(user),
    email: user.email ?? "",
    role: user.role,
  };

  await db.collection("auditLogs").add({
    action,
    category: details.category ?? (details.financialData ? "financial" : "subscriber"),
    severity: details.severity ?? "info",
    source: "server",
    entityType: details.entityType ?? null,
    entityId: details.entityId ?? null,
    entityName: details.entityName ?? null,
    description: details.description ?? null,
    previousData: details.previousData ?? null,
    newData: details.newData ?? null,
    changedFields: details.changedFields ?? [],
    performedBy: performer,
    financialData: details.financialData ?? null,
    metadata: details.metadata ?? {},
    tags: ["server-operation"],
    status: "completed",
    actorUid: performer.uid,
    actorName: performer.name,
    actorRole: performer.role,
    targetType: details.entityType ?? null,
    targetId: details.entityId ?? null,
    targetName: details.entityName ?? null,
    summary: details.description ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Fire-and-forget notification (non-blocking)
  createServerNotification({
    action,
    entityType:   details.entityType,
    entityId:     details.entityId,
    entityName:   details.entityName,
    description:  details.description,
    performedBy:  performer,
    financialData: details.financialData as { amount?: number; currency?: string; amountUSD?: number } | null,
    metadata:     details.metadata,
  }).catch(() => {});
}

function requirePermission(user: NonNullable<ServerUser>, operation: Operation) {
  const requirements: Partial<Record<Operation, [string, string]>> = {
    createSubscriber: ["subscribers", "create"],
    updateSubscriber: ["subscribers", "edit"],
    deleteSubscriber: ["subscribers", "delete"],
    addPayment: ["payments", "create"],
    renewSubscription: ["subscriptions", "renew"],
    withdrawSubscriber: ["subscriptions", "withdraw"],
    pauseSubscription: ["subscriptions", "freeze"],
    resumePausedSubscription: ["subscriptions", "resume"],
    freezeSubscription: ["subscriptions", "freeze"],
    resumeSubscription: ["subscriptions", "resume"],
    // Reviewing proof of payment is a payments-desk job, not a sales one:
    // payments.edit is the permission an admin holds and a salesperson does not,
    // so the person who recorded a payment cannot also sign it off.
    verifyReceipt: ["payments", "edit"],
    // An adjustment moves money that was already counted. That is the refund
    // permission's weight class, not the "record a payment" one — a salesperson
    // who can take money must not also be able to write it off.
    adjustPayment: ["payments", "refund"],
  };
  const required = requirements[operation];
  return required ? hasServerPermission(user, required[0], required[1]) : false;
}

/**
 * Which row-level action each operation represents.
 *
 * `requirePermission` above answers "may this person renew subscriptions?".
 * This answers the separate question the route never asked: "may they renew
 * *this* subscription?". Holding the capability is not the same as the
 * capability reaching a colleague's record, and firestore.rules cannot help
 * here — every write below goes through the Admin SDK, which bypasses rules.
 *
 * createSubscriber is absent deliberately: there is no existing record to own.
 */
const OPERATION_ACTIONS: Partial<Record<Operation, SubscriberAction>> = {
  updateSubscriber:         "edit",
  deleteSubscriber:         "delete",
  addPayment:               "payment",
  renewSubscription:        "renew",
  withdrawSubscriber:       "withdraw",
  pauseSubscription:        "pause",
  resumePausedSubscription: "resume",
  freezeSubscription:       "freeze",
  resumeSubscription:       "resume",
  adjustPayment:            "payment",
};

/**
 * Returns an error response when the actor may not touch this subscriber, or
 * null to proceed.
 *
 * Costs one document read for employees; owner and admin short-circuit before
 * it. The handler re-reads inside its transaction, so a concurrent reassignment
 * between the two reads could in principle slip through — reassignment is
 * itself gated by this module, and the window is a single round trip.
 */
async function denyIfNotOwned(
  user: NonNullable<ServerUser>,
  operation: Operation,
  payload: Record<string, unknown>
): Promise<NextResponse | null> {
  const action = OPERATION_ACTIONS[operation];
  if (!action) return null;
  if (user.role === "owner" || user.role === "admin") return null;

  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) return jsonError("Missing subscriberId", 400);

  const snap = await getFirestore().collection("subscribers").doc(subscriberId).get();
  if (!snap.exists) return jsonError("Subscriber not found", 404);

  const decision = canMutateSubscriber(
    user,
    snap.data() as SubscriberLinkFields,
    action
  );
  return decision.allowed ? null : jsonError(decision.reason ?? "Forbidden", 403);
}

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit: 120 operations per IP per minute (generous for normal use,
  // blocks automated abuse / rapid-fire mutation loops).
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`sub-ops:${ip}`, 120, 60 * 1000))) {
    return jsonError("Too many requests", 429);
  }

  let user: ServerUser;
  try {
    user = await verifyServerUser(request);
  } catch (err) {
    console.error("[subscriber-operations] auth failed:", err);
    return jsonError("Unauthorized", 401);
  }

  if (!user) return jsonError("Unauthorized", 401);

  // All subscriber writes go through Admin SDK (rules deny client writes).
  if (!hasAdminCredentials()) {
    return jsonError("Admin credentials غير مفعّلة على السيرفر", 503);
  }

  let body: OperationBody;
  try {
    body = (await request.json()) as OperationBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.operation || !VALID_OPERATIONS.has(body.operation)) {
    return jsonError("Invalid or missing operation", 400);
  }
  if (!requirePermission(user, body.operation)) return jsonError("Forbidden", 403);

  // Validate the payload against the operation-specific Zod schema
  const schemaResult = OPERATION_SCHEMAS[body.operation].safeParse(body.payload ?? {});
  if (!schemaResult.success) {
    return jsonError(schemaResult.error.issues[0]?.message ?? "Validation error", 422);
  }

  const payload = schemaResult.data as Record<string, unknown>;

  // Capability granted above; this checks it reaches this particular record.
  const notOwned = await denyIfNotOwned(user, body.operation, payload);
  if (notOwned) return notOwned;

  try {
    switch (body.operation) {
      case "createSubscriber":
        return NextResponse.json(await createSubscriber(user, payload));
      case "updateSubscriber":
        return NextResponse.json(await updateSubscriber(user, payload));
      case "deleteSubscriber":
        return NextResponse.json(await deleteSubscriber(user, payload));
      case "addPayment":
        return NextResponse.json(await addPayment(user, payload));
      case "renewSubscription":
        return NextResponse.json(await renewSubscription(user, payload));
      case "withdrawSubscriber":
        return NextResponse.json(await withdrawSubscriber(user, payload));
      case "pauseSubscription":
        return NextResponse.json(await pauseSubscription(user, payload));
      case "resumePausedSubscription":
        return NextResponse.json(await resumePausedSubscription(user, payload));
      case "freezeSubscription":
        return NextResponse.json(await freezeSubscription(user, payload));
      case "resumeSubscription":
        return NextResponse.json(await resumeSubscription(user, payload));
      case "verifyReceipt":
        return NextResponse.json(await verifyReceipt(user, payload));
      case "adjustPayment":
        return NextResponse.json(await adjustPayment(user, payload));
      default:
        return jsonError("Unknown operation", 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[subscriber-operations] operation failed:", message);
    // Failures thrown from inside a handler may carry their own status, so a
    // deliberate refusal answers as one rather than as the 500 a bare throw
    // produces. A refusal reported as a server fault reads as "the site is
    // broken, try again", which is the opposite of what it means — and a caller
    // cannot tell a rule from an outage.
    const status = (err as { status?: number })?.status;
    if (status === 403 || status === 404 || status === 409 || status === 422) {
      return jsonError(message, status);
    }
    // Expose domain-level validation errors (short, user-facing messages) to the client.
    // Suppress raw Firestore/internal error strings.
    const isSafeMessage = message.length < 200 && !/firestore|grpc|google|internal/i.test(message);
    return jsonError(isSafeMessage ? message : "Operation failed", 500);
  }
}

async function createSubscriber(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriber = asRecord(payload.subscriber);
  const initialPayment = asRecord(payload.initialPayment);
  const amountOriginal = asNumber(initialPayment.amountOriginal);
  const exchangeRate = normalizeExchangeRate(
    initialPayment.exchangeRate,
    normalizeExchangeRate(subscriber.lockedRate)
  );
  const subRef = db.collection("subscribers").doc();
  const paymentRef = db.collection("payments").doc();

  const safeSubscriber = pickWritableFields(subscriber);
  if (!asString(safeSubscriber.name)) throw new Error("Subscriber name is required");

  // Prefer explicit UID; fall back to a UID lookup by employeeName for legacy callers
  let convincedByUid = asString(safeSubscriber.convincedByUid);
  if (!convincedByUid && safeSubscriber.convincedBy) {
    const empSnap = await db.collection("users")
      .where("employeeName", "==", safeSubscriber.convincedBy)
      .limit(1)
      .get();
    if (!empSnap.empty) convincedByUid = empSnap.docs[0].id;
  }

  // An employee creates subscribers for themselves. Without this they could
  // attribute a new record to a colleague — and, since convincedByUid is what
  // row-level access reads, create a subscriber they then could not touch, or
  // quietly move a sale onto someone else's numbers.
  if (user.role !== "owner" && user.role !== "admin") {
    if (convincedByUid && convincedByUid !== user.uid) {
      const error = new Error("لا يمكنك إنشاء مشترك منسوب لموظف آخر") as Error & { status?: number };
      error.status = 403;
      throw error;
    }
    convincedByUid = user.uid;
  }

  if (convincedByUid) safeSubscriber.convincedByUid = convincedByUid;

  // The initial payment was written as a payments document but never applied to
  // the subscriber's balance: the record was saved with paidAmountUSD 0 and
  // remainingAmountUSD equal to the full price, so a subscriber who had just
  // paid in full showed as owing everything. computePaymentUpdate is the same
  // function addPayment uses, so the two paths now agree — including its
  // overpayment guard, which this path had no equivalent of.
  const totalPriceUSD = asNumber(safeSubscriber.totalPriceUSD);
  const lockedRate = normalizeExchangeRate(safeSubscriber.lockedRate, exchangeRate);
  const opening =
    amountOriginal > 0
      ? computePaymentUpdate({
          amountOriginal,
          exchangeRate,
          current: { paidAmountUSD: 0, totalPriceUSD, refundAmountUSD: 0, lockedRate },
        })
      : {
          amountUSD: 0,
          paidAmountUSD: 0,
          paidAmount: 0,
          remainingAmountUSD: Math.max(0, totalPriceUSD),
          remainingAmount: Math.max(0, totalPriceUSD) * lockedRate,
          netAmountUSD: 0,
        };
  const amountUSD = opening.amountUSD;

  // ── Billing ledger ──────────────────────────────────────────────────────────
  // Cycle #1 and its invoice are written in the same transaction as the
  // subscriber. The legacy summary fields below are unchanged and still carry
  // the balance — the ledger is additional, never a replacement, so a failure to
  // build a schedule can never leave a subscriber without a balance.
  const today = todayString();
  const startDate = asString(safeSubscriber.startDate) || asString(safeSubscriber.date) || today;
  const plan = asRecord(payload.paymentPlan);
  const totalPriceOriginal = asNumber(safeSubscriber.totalPrice);
  const currencyOriginal = asString(subscriber.currencyOriginal, "USD");
  const schedule = buildSchedule(
    plan,
    { totalOriginal: totalPriceOriginal, downPaymentOriginal: amountOriginal, exchangeRate },
    addDays(startDate, 30)
  );
  const planType = schedule.length > 0 ? "installments" : "full";
  // With a schedule the invoice is due when the last instalment is; without one
  // it is due on the date the caller named, or immediately.
  const invoiceDueDate =
    schedule.length > 0
      ? schedule[schedule.length - 1].dueDate
      : asString(plan.dueDate, startDate);

  let invoiceId: string | null = null;
  let cycleId: string | null = null;
  let invoiceNumber = "";

  await db.runTransaction(async (tx) => {
    // Every read must precede every write in a Firestore transaction, and
    // reserving the invoice number is a read.
    const counter = totalPriceUSD > 0
      ? await reserveInvoiceNumber(tx, db, Number(today.slice(0, 4)))
      : null;

    const cycle = stageCycle(tx, db, {
      subscriberId:   subRef.id,
      subscriberName: asString(subscriber.name),
      convincedByUid,
      cycleNumber:    1,
      package:        asString(safeSubscriber.package),
      duration:       asNumber(safeSubscriber.duration),
      startDate,
      expiryDate:     asString(safeSubscriber.expiryDate),
      currencyOriginal,
      listPriceOriginal:  totalPriceOriginal,
      discountOriginal:   0,
      totalPriceOriginal,
      exchangeRate,
      totalPriceUSD,
      paidAmountUSD: opening.paidAmountUSD,
      actorUid: user.uid,
    });
    cycleId = cycle.cycleId;

    if (counter) {
      counter.commit();
      invoiceNumber = counter.invoiceNumber;
      const staged = stageInvoice(tx, db, {
        invoiceNumber,
        subscriberId:   subRef.id,
        subscriberName: asString(subscriber.name),
        convincedByUid,
        cycleId:     cycle.cycleId,
        cycleNumber: 1,
        issueDate:   startDate,
        dueDate:     invoiceDueDate,
        currencyOriginal,
        subtotalOriginal: totalPriceOriginal,
        discountOriginal: 0,
        totalOriginal:    totalPriceOriginal,
        exchangeRate,
        totalUSD: totalPriceUSD,
        paidUSD:  opening.paidAmountUSD,
        planType,
        schedule,
        notes: asString(safeSubscriber.notes) || null,
        actorUid: user.uid,
        today,
      });
      invoiceId = staged.invoiceId;
    }

    tx.set(subRef, {
      ...safeSubscriber,
      // حفظ startDate صراحةً لضمان اتساق البيانات مع renewals
      startDate,
      subscriptionState: "active",
      paidAmount: opening.paidAmount,
      paidAmountUSD: opening.paidAmountUSD,
      totalPriceUSD,
      remainingAmount: opening.remainingAmount,
      remainingAmountUSD: opening.remainingAmountUSD,
      netAmountUSD: opening.netAmountUSD,
      lifetimeValueUSD: opening.paidAmountUSD,
      refundAmount: 0,
      refundAmountUSD: 0,
      renewalCount: 0,
      // Pointers into the ledger. Absent on every pre-existing subscriber, which
      // is what legacyToCurrentCycleView() exists to handle.
      currentCycleId: cycle.cycleId,
      currentCycleNumber: 1,
      currentInvoiceId: invoiceId,
      paymentPlanType: planType,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (amountOriginal > 0) {
      const initPmId = asString(initialPayment.paymentMethodId);
      tx.set(paymentRef, {
        subscriberId: subRef.id,
        subscriberName: asString(subscriber.name),
        ...(convincedByUid ? { convincedByUid } : {}),
        amountOriginal,
        currencyOriginal: asString(initialPayment.currencyOriginal, currencyOriginal),
        exchangeRate,
        amountUSD,
        paymentMethod: asString(initialPayment.paymentMethod, asString(subscriber.payment)),
        ...(initPmId ? { paymentMethodId: initPmId } : {}),
        receiptUrl: initialPayment.receiptUrl ?? null,
        receiptFileName: initialPayment.receiptFileName ?? null,
        externalReference: asString(initialPayment.externalReference).trim() || null,
        receiptStatus: initialPayment.receiptUrl ? "pending_review" : "missing",
        settlementStatus: "unreconciled",
        date: asString(initialPayment.date, asString(subscriber.date, today)),
        notes: initialPayment.notes ?? null,
        paymentType: "initial",
        isInitialPayment: true,
        isRenewalPayment: false,
        cycleId: cycle.cycleId,
        cycleNumber: 1,
        invoiceId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
      });
    }
  });

  await writeAudit(user, "subscriber_created", {
    severity: "success",
    entityType: "subscriber",
    entityId: subRef.id,
    entityName: asString(subscriber.name),
    description: `Created subscriber: ${asString(subscriber.name)}`,
    metadata: {
      hasInitialPayment: amountOriginal > 0,
      cycleId, invoiceId, invoiceNumber: invoiceNumber || null,
      paymentPlanType: planType,
      installmentCount: schedule.length,
    },
  });

  return {
    success: true,
    subscriberId: subRef.id,
    cycleId,
    invoiceId,
    invoiceNumber: invoiceNumber || null,
    installmentCount: schedule.length,
  };
}

async function updateSubscriber(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");

  const raw = asRecord(payload.subscriber);
  const ref = db.collection("subscribers").doc(subscriberId);

  // Read first: refusing an attempt to move a term of the sale needs the value
  // that is actually stored, not the one the caller says is stored.
  const beforeSnap = await ref.get();
  if (!beforeSnap.exists) throw new Error("Subscriber not found");
  const beforeData = beforeSnap.data() ?? {};

  /*
   * The terms of the sale are refused here, not filtered out.
   *
   * Dropping them quietly would be the same failure this file already had once:
   * a caller sends a value, gets a success, and the value is nowhere. A price
   * someone believes they changed is worse than a price they were told they
   * could not change. Only a *different* value is refused — an unchanged echo of
   * the stored record is dropped, so the edit dialog can still rename a person.
   */
  const violations = findImmutableViolations(raw, beforeData);
  if (violations.length > 0) {
    const error = new Error(immutableRefusalMessage(violations)) as Error & { status?: number };
    error.status = 422;
    throw error;
  }

  // Allow-list: identity and contact only. The terms of the sale are set when
  // the subscription is sold and moved afterwards only by a named operation.
  const safeUpdate = pickWritable(raw, UPDATE_WRITABLE_SUBSCRIBER_FIELDS);
  if (Object.keys(safeUpdate).length === 0) throw new Error("No valid fields to update");

  // If convincedBy name is being changed without an explicit UID, resolve it now
  if (safeUpdate.convincedBy && !safeUpdate.convincedByUid) {
    const empSnap = await db.collection("users")
      .where("employeeName", "==", safeUpdate.convincedBy)
      .limit(1)
      .get();
    if (!empSnap.empty) safeUpdate.convincedByUid = empSnap.docs[0].id;
  }

  const changedFields = Object.keys(safeUpdate);
  const previousData = Object.fromEntries(changedFields.map((k) => [k, beforeData[k] ?? null]));

  await ref.update({
    ...safeUpdate,
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit(user, "subscriber_updated", {
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: asString(safeUpdate.name ?? beforeData.name),
    description: `Updated subscriber: ${asString(safeUpdate.name ?? beforeData.name, subscriberId)}`,
    metadata: { changedFields, previousData, newData: safeUpdate },
  });

  return { success: true };
}

async function deleteSubscriber(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const ref = db.collection("subscribers").doc(subscriberId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Subscriber not found");
  const name = asString(snap.data()?.name, asString(payload.subscriberName, subscriberId));

  // Soft delete — preserves financial records and audit trail integrity.
  // All query filters already use where("deleted", "!=", true) patterns.
  await ref.update({
    deleted:   true,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  });

  await writeAudit(user, "subscriber_deleted", {
    severity: "critical",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: name,
    description: `Soft-deleted subscriber: ${name}`,
  });

  return { success: true };
}

async function addPayment(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const amountOriginal = asNumber(payload.amountOriginal);
  if (amountOriginal <= 0) throw new Error("Payment amount must be greater than zero");
  const exchangeRate = normalizeExchangeRate(payload.exchangeRate);
  const amountUSD = amountOriginal / exchangeRate;
  const subRef = db.collection("subscribers").doc(subscriberId);
  const paymentRef = db.collection("payments").doc();
  let subscriberName = "";
  let prevPaidUSD = 0;
  let prevRemainingUSD = 0;
  let newPaidUSD = 0;
  let newRemainingUSD = 0;

  const today = todayString();
  let ledger: ReturnType<typeof stageLedgerPayment> | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    prevPaidUSD = asNumber(current.paidAmountUSD);
    prevRemainingUSD = asNumber(current.remainingAmountUSD);

    // Reads first — Firestore transactions forbid a read after a write. Returns
    // nulls for a subscriber with no ledger, which is every record created
    // before instalments existed; the legacy balance below still applies.
    const open = await readOpenLedger(tx, db, subscriberId, asString(current.currentCycleId) || null);

    // Balance maths lives in lib/subscriberFinance so it can be unit tested
    // without Firestore. Throws on an overpayment beyond the rounding tolerance.
    const balance = computePaymentUpdate({
      amountOriginal,
      exchangeRate,
      current: {
        paidAmountUSD: prevPaidUSD,
        totalPriceUSD: asNumber(current.totalPriceUSD),
        refundAmountUSD: asNumber(current.refundAmountUSD),
        lockedRate: asNumber(current.lockedRate, 1),
      },
    });

    ledger = stageLedgerPayment(tx, db, {
      paymentId: paymentRef.id,
      amountUSD,
      invoice: open.invoice,
      installments: open.installments,
      targetInstallmentId: asString(payload.installmentId) || null,
      actorUid: user.uid,
      today,
    });

    const pmId = asString(payload.paymentMethodId);
    const subConvincedByUid = asString(current.convincedByUid);
    tx.set(paymentRef, {
      subscriberId,
      subscriberName,
      ...(subConvincedByUid ? { convincedByUid: subConvincedByUid } : {}),
      amountOriginal,
      currencyOriginal: asString(payload.currencyOriginal, "USD"),
      exchangeRate,
      amountUSD,
      paymentMethod: asString(payload.paymentMethod),
      ...(pmId ? { paymentMethodId: pmId } : {}),
      receiptUrl: payload.receiptUrl ?? null,
      receiptFileName: payload.receiptFileName ?? null,
      externalReference: asString(payload.externalReference).trim() || null,
      receiptStatus: payload.receiptUrl ? "pending_review" : "missing",
      settlementStatus: "unreconciled",
      date: asString(payload.date, today),
      notes: asString(payload.notes).trim() || null,
      // A payment against a subscription that is already running is an
      // instalment, whatever the plan is called. Renewals set their own type.
      paymentType: "installment",
      isInitialPayment: false,
      isRenewalPayment: false,
      cycleId:     ledger.cycleId,
      cycleNumber: ledger.cycleNumber,
      invoiceId:   ledger.invoiceId,
      installmentAllocations: ledger.allocations.map((a) => ({
        installmentId: a.installmentId,
        installmentNumber: a.installmentNumber,
        appliedUSD: a.appliedUSD,
      })),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
    });

    newPaidUSD = balance.paidAmountUSD;
    newRemainingUSD = balance.remainingAmountUSD;

    tx.update(subRef, {
      paidAmountUSD: balance.paidAmountUSD,
      paidAmount: balance.paidAmount,
      remainingAmountUSD: balance.remainingAmountUSD,
      remainingAmount: balance.remainingAmount,
      netAmountUSD: balance.netAmountUSD,
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit(user, "payment_created", {
    severity: "success",
    entityType: "payment",
    entityId: paymentRef.id,
    entityName: subscriberName,
    description: `Payment added: ${subscriberName}`,
    financialData: {
      amount: amountOriginal,
      currency: asString(payload.currencyOriginal, "USD"),
      amountUSD,
      impactType: "positive",
    },
    previousData: { paidAmountUSD: prevPaidUSD, remainingAmountUSD: prevRemainingUSD },
    newData:      { paidAmountUSD: newPaidUSD,  remainingAmountUSD: newRemainingUSD },
    changedFields: ["paidAmountUSD", "remainingAmountUSD", "netAmountUSD"],
    metadata: {
      subscriberId,
      invoiceId:   (ledger as { invoiceId?: string | null } | null)?.invoiceId ?? null,
      allocations: (ledger as { allocations?: unknown[] } | null)?.allocations ?? [],
    },
  });

  return {
    success: true,
    paymentId: paymentRef.id,
    allocations:   (ledger as { allocations?: unknown[] } | null)?.allocations ?? [],
    invoiceStatus: (ledger as { invoiceStatus?: string | null } | null)?.invoiceStatus ?? null,
  };
}

async function renewSubscription(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");

  const duration = asNumber(payload.duration, 30);
  const currency = asString(payload.currency, "USD");
  const exchangeRate = normalizeExchangeRate(payload.exchangeRate);
  const { totalPrice, totalPriceUSD, paidAmount, paidUSD, remaining, remainingUSD, netAmountUSD } =
    computeRenewalTotals({
      totalPrice: asNumber(payload.totalPrice),
      paidAmount: payload.paidAmount as number | null | undefined,
      exchangeRate,
    });
  const renewalDate = asString(payload.renewalDate, todayString());
  const subRef = db.collection("subscribers").doc(subscriberId);
  const paymentRef = db.collection("payments").doc();
  let subscriberName = "";
  let renewalNumber = 1;
  let prevState: Record<string, unknown> = {};

  // Renewal history documents are written to a sub-collection (not embedded array)
  // to prevent the subscriber document from hitting Firestore's 1 MB size limit.
  const historyRef = db.collection("subscribers").doc(subscriberId)
                       .collection("renewalHistory").doc();

  const today = todayString();
  const plan = asRecord(payload.paymentPlan);
  let newCycleId: string | null = null;
  let newInvoiceId: string | null = null;
  let scheduleLength = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);

    // Read before write — reserving the invoice number is a read.
    const counter = totalPriceUSD > 0
      ? await reserveInvoiceNumber(tx, db, Number(today.slice(0, 4)))
      : null;

    // Capture before-state for audit
    prevState = {
      subscriptionState:  current.subscriptionState,
      expiryDate:         current.expiryDate,
      paidAmountUSD:      asNumber(current.paidAmountUSD),
      totalPriceUSD:      asNumber(current.totalPriceUSD),
      remainingAmountUSD: asNumber(current.remainingAmountUSD),
      renewalCount:       asNumber(current.renewalCount),
    };
    const isWithdrawn = asString(current.subscriptionState) === "withdrawn";
    // Renewing early appends the new term to the current expiry so the unused
    // tail of the running cycle is not thrown away.
    const { startDate, endDate } = resolveRenewalWindow({
      subscriptionState: asString(current.subscriptionState),
      currentExpiryDate: asString(current.expiryDate, renewalDate),
      renewalDate,
      duration,
    });
    renewalNumber = asNumber(current.renewalCount) + 1;

    // Snapshot of the subscription state BEFORE this renewal
    const historyDoc = {
      renewalNumber,
      package:            asString(current.package) || null,
      startDate:          current.startDate || current.date || "",
      endDate:            current.expiryDate || "",
      duration:           asNumber(current.duration),
      totalPrice:         asNumber(current.totalPrice),
      totalPriceUSD:      asNumber(current.totalPriceUSD),
      paidAmountUSD:      asNumber(current.paidAmountUSD),
      remainingAmountUSD: asNumber(current.remainingAmountUSD),
      netAmountUSD:       asNumber(current.netAmountUSD),
      currency:           current.currencyOriginal || "USD",
      lockedRate:         asNumber(current.lockedRate, 1),
      payment:            current.payment || "",
      convincedBy:        current.convincedBy || "",
      paidShift:          current.paidShift || "",
      snapshotStatus:     isWithdrawn ? "withdrawn" : "active",
      renewedBy:          user.uid,
      renewedByName:      actorName(user),
      createdAt:          FieldValue.serverTimestamp(),
    };

    // ── Billing ledger: a renewal is a new cycle, not an edit of the old one ──
    //
    // The subscriber document is still overwritten in place exactly as before —
    // that is what every existing screen reads — and `renewalHistory` still gets
    // its snapshot. What changes is that the outgoing term now survives as its
    // own addressable document with its own invoice, instead of only as a
    // flattened snapshot, so "what did cycle 2 actually cost and collect" has an
    // answer.
    const previousCycleId = asString(current.currentCycleId) || null;
    if (previousCycleId) {
      stageCloseCycle(
        tx, db, previousCycleId,
        isWithdrawn ? "withdrawn" : "completed",
        user.uid,
        `renewed into cycle ${renewalNumber + 1}`
      );
    }

    const schedule = buildSchedule(
      plan,
      { totalOriginal: totalPrice, downPaymentOriginal: paidAmount, exchangeRate },
      addDays(startDate, 30)
    );
    scheduleLength = schedule.length;
    const planType = schedule.length > 0 ? "installments" : "full";
    const renewConvinced = asString(current.convincedByUid) || null;

    const cycle = stageCycle(tx, db, {
      subscriberId,
      subscriberName,
      convincedByUid: renewConvinced,
      // renewalNumber counts renewals; the cycle it produces is the next one.
      cycleNumber: renewalNumber + 1,
      package:     asString(payload.package, asString(current.package)),
      duration,
      startDate,
      expiryDate: endDate,
      currencyOriginal: currency,
      listPriceOriginal:  totalPrice,
      discountOriginal:   0,
      totalPriceOriginal: totalPrice,
      exchangeRate,
      totalPriceUSD,
      paidAmountUSD: paidUSD,
      actorUid: user.uid,
    });
    newCycleId = cycle.cycleId;

    if (counter) {
      counter.commit();
      const staged = stageInvoice(tx, db, {
        invoiceNumber:  counter.invoiceNumber,
        subscriberId,
        subscriberName,
        convincedByUid: renewConvinced,
        cycleId:     cycle.cycleId,
        cycleNumber: renewalNumber + 1,
        issueDate:   renewalDate,
        dueDate:     schedule.length > 0
          ? schedule[schedule.length - 1].dueDate
          : asString(plan.dueDate, startDate),
        currencyOriginal: currency,
        subtotalOriginal: totalPrice,
        discountOriginal: 0,
        totalOriginal:    totalPrice,
        exchangeRate,
        totalUSD: totalPriceUSD,
        paidUSD,
        planType,
        schedule,
        notes: asString(payload.notes).trim() || null,
        actorUid: user.uid,
        today,
      });
      newInvoiceId = staged.invoiceId;
    }

    tx.update(subRef, {
      date: startDate,
      startDate,
      expiryDate: endDate,
      duration,
      currentCycleId:     cycle.cycleId,
      currentCycleNumber: renewalNumber + 1,
      currentInvoiceId:   newInvoiceId,
      paymentPlanType:    planType,
      package: asString(payload.package, asString(current.package)),
      currencyOriginal: currency,
      currency,
      lockedRate: exchangeRate,
      totalPrice,
      totalPriceUSD,
      amount: totalPrice,
      amountUSD: totalPriceUSD,
      paidAmount,
      paidAmountUSD: paidUSD,
      remainingAmount: remaining,
      remainingAmountUSD: remainingUSD,
      netAmountUSD,
      refundAmount: 0,
      refundAmountUSD: 0,
      payment: asString(payload.paymentMethod, asString(current.payment)),
      subscriptionState: "active",
      subscriptionStatus: "active",
      status: "نشط",
      renewalCount: renewalNumber,
      lifetimeValueUSD: asNumber(current.lifetimeValueUSD, asNumber(current.paidAmountUSD)) + paidUSD,
      lastRenewalDate: FieldValue.serverTimestamp(),
      withdrawnAt: null,
      withdrawalReason: null,
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Write history entry to sub-collection (not embedded array)
    tx.set(historyRef, historyDoc);

    if (paidAmount > 0) {
      const renewPmId = asString(payload.paymentMethodId);
      const renewConvincedByUid = asString(current.convincedByUid);
      tx.set(paymentRef, {
        subscriberId,
        subscriberName,
        ...(renewConvincedByUid ? { convincedByUid: renewConvincedByUid } : {}),
        amountOriginal: paidAmount,
        currencyOriginal: currency,
        exchangeRate,
        amountUSD: paidUSD,
        paymentMethod: asString(payload.paymentMethod),
        ...(renewPmId ? { paymentMethodId: renewPmId } : {}),
        paymentType: "renewal",
        date: renewalDate,
        notes: asString(payload.notes).trim() || null,
        receiptUrl: payload.receiptUrl ?? null,
        receiptFileName: payload.receiptFileName ?? null,
        externalReference: asString(payload.externalReference).trim() || null,
        receiptStatus: payload.receiptUrl ? "pending_review" : "missing",
        settlementStatus: "unreconciled",
        isInitialPayment: false,
        isRenewalPayment: true,
        renewalNumber,
        cycleId:     newCycleId,
        cycleNumber: renewalNumber + 1,
        invoiceId:   newInvoiceId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
      });
    }
  });

  await writeAudit(user, "subscriber_renewed", {
    severity: "success",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Renewed subscription: ${subscriberName}`,
    financialData: {
      amount: paidAmount,
      currency,
      amountUSD: paidUSD,
      impactType: "positive",
    },
    previousData: prevState,
    newData: {
      subscriptionState: "active",
      paidAmountUSD: paidUSD,
      totalPriceUSD,
      remainingAmountUSD: remainingUSD,
      renewalCount: renewalNumber,
    },
    changedFields: ["subscriptionState", "expiryDate", "paidAmountUSD", "totalPriceUSD", "remainingAmountUSD", "renewalCount"],
    metadata: {
      renewalNumber,
      cycleId: newCycleId,
      invoiceId: newInvoiceId,
      installmentCount: scheduleLength,
    },
  });

  return {
    success: true,
    paymentId: paidAmount > 0 ? paymentRef.id : null,
    cycleId: newCycleId,
    invoiceId: newInvoiceId,
    installmentCount: scheduleLength,
  };
}

async function withdrawSubscriber(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const reason = asString(payload.reason).trim();
  if (!reason) throw new Error("Withdrawal reason is required");

  const refundAmount = asNumber(payload.refundAmount);
  const refundCurrency = asString(payload.refundCurrency, "USD");
  const exchangeRate = normalizeExchangeRate(payload.exchangeRate);
  const subRef = db.collection("subscribers").doc(subscriberId);
  const refundRef = db.collection("refunds").doc();
  let subscriberName = "";
  let prevState: Record<string, unknown> = {};
  let refundAmountUSD = 0;
  let hasRefund = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    if (asString(current.subscriptionState) === "withdrawn") throw new Error("Subscription is already withdrawn");
    const today = todayString();
    const previousRefundUSD = asNumber(current.refundAmountUSD);
    const cycleId = asString(current.currentCycleId) || null;
    // Read before write.
    const open = await readOpenLedger(tx, db, subscriberId, cycleId);

    // Capture before-state for audit
    prevState = {
      subscriptionState: current.subscriptionState,
      paidAmountUSD: asNumber(current.paidAmountUSD),
      refundAmountUSD: previousRefundUSD,
      netAmountUSD: asNumber(current.netAmountUSD),
      expiryDate: current.expiryDate,
    };

    // Refunds accumulate across withdrawals, and net revenue floors at zero so
    // a refund larger than everything paid cannot report negative revenue.
    const refund = computeWithdrawalRefund({
      refundAmount,
      exchangeRate,
      previousRefundUSD,
      paidAmountUSD: asNumber(current.paidAmountUSD),
    });
    refundAmountUSD = refund.refundAmountUSD;
    hasRefund = refund.hasRefund;

    if (hasRefund) {
      const refundConvincedByUid = asString(current.convincedByUid);
      tx.set(refundRef, {
        subscriberId,
        subscriberName,
        // Denormalised so firestore.rules can scope refund reads to the employee
        // who owns the subscriber, the same way payments are scoped. Refunds
        // written before this carry no uid and stay staff-only until the
        // backfill script runs — see docs/CHANGELOG-2026-08-10.md.
        ...(refundConvincedByUid ? { convincedByUid: refundConvincedByUid } : {}),
        refundAmount,
        refundCurrency,
        exchangeRate,
        refundAmountUSD,
        refundDate: today,
        refundReason: reason,
        notes: asString(payload.notes).trim() || null,
        relatedWithdrawalId: refundRef.id,
        isWithdrawalRefund: true,
        financialImpact: "negative",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
        createdByName: actorName(user),
      });
    }

    // The refund lands on the invoice and the cycle as well as the subscriber,
    // so a cycle that was paid and then refunded reads as "refunded" rather than
    // as a paid cycle with an unexplained negative somewhere else.
    if (hasRefund) {
      stageLedgerRefund(tx, db, {
        invoice: open.invoice, cycleId, refundUSD: refundAmountUSD,
        actorUid: user.uid, today,
      });
    }
    stageCycleStatus(tx, db, cycleId, "withdrawn", user.uid, {
      closedAt: FieldValue.serverTimestamp(),
      closedReason: `withdrawn: ${reason}`,
    });

    tx.update(subRef, {
      subscriptionState: "withdrawn",
      subscriptionStatus: "withdrawn",
      status: "منسحب",
      withdrawalData: {
        withdrawnAt: FieldValue.serverTimestamp(),
        withdrawnBy: user.uid,
        withdrawnByName: actorName(user),
        withdrawalReason: reason,
        notes: asString(payload.notes).trim() || null,
        refundIssued: hasRefund,
        refundId: hasRefund ? refundRef.id : null,
        refundAmount: hasRefund ? refundAmount : null,
        refundCurrency: hasRefund ? refundCurrency : null,
        refundAmountUSD: hasRefund ? refundAmountUSD : null,
        exchangeRate: hasRefund ? exchangeRate : null,
        originalPlan: asString(current.package) || null,
        originalExpiryDate: asString(current.expiryDate) || null,
        previousStatus: asString(current.status) || null,
        activeDaysUsed: daysUsed(asString(current.date, asString(current.startDate, today)), today),
        remainingDays: remainingDays(asString(current.expiryDate, today), today),
      },
      withdrawalReason: reason,
      withdrawnAt: today,
      refundAmountUSD: refund.newRefundAmountUSD,
      netAmountUSD: refund.netAmountUSD,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
    });
  });

  await writeAudit(user, "subscriber_withdrawn", {
    severity: "warning",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Withdrawn subscriber: ${subscriberName}`,
    financialData: hasRefund
      ? { amount: refundAmount, currency: refundCurrency, amountUSD: refundAmountUSD, impactType: "negative" }
      : null,
    previousData: prevState,
    newData: { subscriptionState: "withdrawn", refundAmountUSD: prevState.refundAmountUSD as number + refundAmountUSD },
    changedFields: ["subscriptionState", "subscriptionStatus", "refundAmountUSD", "netAmountUSD", "withdrawnAt"],
    metadata: { reason, refundId: hasRefund ? refundRef.id : null },
  });

  return { success: true, refundId: hasRefund ? refundRef.id : null };
}

async function pauseSubscription(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const subRef = db.collection("subscribers").doc(subscriberId);
  let subscriberName = "";

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    const today = todayString();
    const remaining = Math.max(0, asNumber(current.daysRemaining, remainingDays(asString(current.expiryDate, today), today)));
    // The cycle carries the same operational state, so billing screens do not
    // have to re-derive it from three subscriber fields.
    stageCycleStatus(tx, db, asString(current.currentCycleId) || null, "paused", user.uid);

    tx.update(subRef, {
      subscriptionStatus: "paused",
      status: "موقوف",
      pausedAt: FieldValue.serverTimestamp(),
      pausedBy: user.uid,
      pauseReason: asString(payload.reason).trim(),
      pauseNotes: asString(payload.notes).trim() || null,
      remainingDaysAtPause: remaining,
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit(user, "subscriber_paused", {
    severity: "warning",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Paused subscription: ${subscriberName}`,
    metadata: { reason: asString(payload.reason).trim() },
  });

  return { success: true };
}

async function freezeSubscription(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const reason = asString(payload.reason).trim();
  if (!reason) throw new Error("Freeze reason is required");
  const subRef = db.collection("subscribers").doc(subscriberId);
  let subscriberName = "";
  let preservedDays = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    const currentFreeze = asRecord(current.freezeData);
    if (currentFreeze.isFrozen === true) throw new Error("Subscription is already frozen");
    if (asString(current.subscriptionState) === "withdrawn")
      throw new Error("لا يمكن تجميد اشتراك منسحب");
    if (asString(current.subscriptionStatus) === "paused")
      throw new Error("يجب استئناف الاشتراك الموقوف قبل التجميد");
    const today = todayString();
    preservedDays = remainingDays(asString(current.expiryDate, today), today);
    stageCycleStatus(tx, db, asString(current.currentCycleId) || null, "frozen", user.uid);
    tx.update(subRef, {
      freezeData: {
        isFrozen: true,
        frozenAt: FieldValue.serverTimestamp(),
        frozenBy: user.uid,
        freezeReason: reason,
        freezeNotes: asString(payload.notes).trim() || null,
        originalExpiryDate: asString(current.expiryDate, null as unknown as string),
        remainingDays: preservedDays,
        resumedAt: null,
        resumedBy: null,
      },
      status: "متجمد",
      subscriptionStatus: "frozen",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
    });
  });

  await writeAudit(user, "subscriber_frozen", {
    severity: "warning",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Frozen subscription: ${subscriberName}`,
    metadata: { reason, remainingDays: preservedDays },
  });

  return { success: true };
}

async function resumePausedSubscription(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const subRef = db.collection("subscribers").doc(subscriberId);
  let subscriberName = "";
  let newExpiryDate = "";
  let pausedDays = 0;
  let preservedDays = 0;
  let totalPausedDays = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    preservedDays = asNumber(current.remainingDaysAtPause);
    // Days left when the subscription stopped are granted again from today, so
    // time spent paused is not billed.
    newExpiryDate = computeResumeExpiry(preservedDays, todayString());
    const pausedAt = current.pausedAt instanceof Timestamp ? current.pausedAt.toDate() : null;
    pausedDays = elapsedDaysSince(pausedAt ? pausedAt.getTime() : null, Date.now());
    totalPausedDays = asNumber(current.totalPausedDays) + pausedDays;

    stageCycleStatus(tx, db, asString(current.currentCycleId) || null, "active", user.uid, {
      expiryDate: newExpiryDate,
    });

    tx.update(subRef, {
      subscriptionStatus: "active",
      status: "نشط",
      expiryDate: newExpiryDate,
      pausedAt: null,
      pausedBy: null,
      pauseReason: null,
      pauseNotes: null,
      remainingDaysAtPause: null,
      totalPausedDays,
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit(user, "subscriber_pause_resumed", {
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Resumed paused subscription: ${subscriberName}`,
    metadata: { pausedDays, preservedDays, newExpiryDate, totalPausedDays },
  });

  return { success: true, newExpiryDate };
}

async function resumeSubscription(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const subRef = db.collection("subscribers").doc(subscriberId);
  let subscriberName = "";
  let newExpiryDate = "";
  let preservedDays = 0;
  let frozenDays = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    const freezeData = asRecord(current.freezeData);
    if (freezeData.isFrozen !== true) throw new Error("Subscription is not frozen");
    preservedDays = asNumber(freezeData.remainingDays);
    newExpiryDate = computeResumeExpiry(preservedDays, todayString());
    const frozenAt = freezeData.frozenAt instanceof Timestamp ? freezeData.frozenAt.toDate() : null;
    frozenDays = elapsedDaysSince(frozenAt ? frozenAt.getTime() : null, Date.now());

    stageCycleStatus(tx, db, asString(current.currentCycleId) || null, "active", user.uid, {
      expiryDate: newExpiryDate,
    });

    tx.update(subRef, {
      freezeData: {
        ...freezeData,
        isFrozen: false,
        resumedAt: FieldValue.serverTimestamp(),
        resumedBy: user.uid,
      },
      expiryDate: newExpiryDate,
      daysRemaining: preservedDays,
      status: "نشط",
      subscriptionStatus: "active",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
    });
  });

  await writeAudit(user, "subscriber_freeze_resumed", {
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Resumed frozen subscription: ${subscriberName}`,
    metadata: { frozenDays, preservedDays, newExpiryDate },
  });

  return { success: true, newExpiryDate };
}

/**
 * Record a human decision about a payment's proof of payment.
 *
 * What this deliberately does NOT do is move money. `amountUSD`,
 * `paidAmountUSD`, the invoice and the instalments are all untouched — a
 * payment counts from the moment it is recorded, and always has. Making the
 * balance depend on receipt review would mean a cash payment with no slip reads
 * as unpaid and the customer gets chased for money they already handed over,
 * and it would silently restate every historical balance in the system the day
 * it shipped.
 *
 * Two guards beyond the payments.edit permission the router checks:
 *
 *  • Row-level ownership, checked here rather than in denyIfNotOwned because
 *    this is the one operation keyed by paymentId rather than subscriberId.
 *    ROLE_CEILING grants payments.edit to employees, so without this any
 *    employee could sign off any colleague's payment.
 *  • A payment with no receipt attached cannot be verified. Approving proof
 *    that does not exist is the failure this whole workflow is meant to catch.
 */
async function verifyReceipt(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const paymentId = asString(payload.paymentId);
  if (!paymentId) throw new Error("Missing paymentId");

  const decision = asString(payload.decision);
  const reason = asString(payload.reason).trim();
  if (decision === "reject" && !reason) throw new Error("سبب الرفض مطلوب");

  const paymentRef = db.collection("payments").doc(paymentId);
  const paySnap = await paymentRef.get();
  if (!paySnap.exists) throw new Error("Payment not found");
  const payment = paySnap.data() ?? {};

  const subscriberId = asString(payment.subscriberId);
  if (!subscriberId) throw new Error("Payment is not linked to a subscriber");

  if (user.role !== "owner" && user.role !== "admin") {
    const subSnap = await db.collection("subscribers").doc(subscriberId).get();
    if (!subSnap.exists) throw new Error("Subscriber not found");
    const decisionOwn = canMutateSubscriber(user, subSnap.data() as SubscriberLinkFields, "payment");
    if (!decisionOwn.allowed) {
      const error = new Error(decisionOwn.reason ?? "Forbidden") as Error & { status?: number };
      error.status = 403;
      throw error;
    }
  }

  if (decision === "verify" && !payment.receiptUrl) {
    throw new Error("لا يمكن التحقق من دفعة بلا وصل مرفوع");
  }

  const previousStatus = asString(payment.receiptStatus) || (payment.receiptUrl ? "pending_review" : "missing");

  await paymentRef.update({
    receiptStatus:   decision === "verify" ? "verified" : "rejected",
    verifiedBy:      user.uid,
    verifiedByName:  actorName(user),
    verifiedAt:      FieldValue.serverTimestamp(),
    rejectionReason: decision === "reject" ? reason : null,
  });

  await writeAudit(user, decision === "verify" ? "receipt_verified" : "receipt_rejected", {
    category:   "financial",
    severity:   decision === "verify" ? "info" : "warning",
    entityType: "payment",
    entityId:   paymentId,
    entityName: asString(payment.subscriberName, subscriberId),
    description: decision === "verify"
      ? `تم التحقق من وصل الدفعة (${asString(payment.subscriberName, subscriberId)})`
      : `تم رفض وصل الدفعة (${asString(payment.subscriberName, subscriberId)}) — ${reason}`,
    previousData: { receiptStatus: previousStatus },
    newData:      { receiptStatus: decision === "verify" ? "verified" : "rejected" },
    changedFields: ["receiptStatus", "verifiedBy", "verifiedAt"],
    metadata: { subscriberId, paymentId, reason: reason || null },
  });

  return { success: true, receiptStatus: decision === "verify" ? "verified" : "rejected" };
}

/**
 * Record a correction to money already counted.
 *
 * The original payment is never touched. Correcting a $500 payment that should
 * have been $50 writes a −$450 adjustment beside it; both documents survive, and
 * the audit trail shows the error and the fix rather than a balance that
 * silently changed. That is the difference between a ledger and a spreadsheet.
 *
 * The maths deliberately reuses the same guards as a payment:
 *
 *  • A positive adjustment cannot push the total paid past the subscription
 *    price, for the same reason a payment cannot.
 *  • A negative one cannot drive the balance below zero — a refund is the
 *    instrument for money that physically went back to the customer, and
 *    conflating the two would double-count it against revenue.
 *
 * Instalments are untouched on purpose; see stageLedgerAdjustment.
 */
async function adjustPayment(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");

  const amountUSD = asNumber(payload.amountUSD);
  if (!Number.isFinite(amountUSD) || amountUSD === 0) throw new Error("مبلغ التسوية مطلوب");

  const reason = asString(payload.reason).trim();
  if (!reason) throw new Error("سبب التسوية مطلوب");

  const adjustmentType = asString(payload.adjustmentType, "correction");
  const today = todayString();
  const date = asString(payload.date, today);
  const exchangeRate = normalizeExchangeRate(payload.exchangeRate);

  const subRef = db.collection("subscribers").doc(subscriberId);
  const adjRef = db.collection(ADJUSTMENTS).doc();

  let subscriberName = "";
  let prevPaidUSD = 0;
  let newPaidUSD = 0;
  let invoiceStatus: string | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);

    const cycleId = asString(current.currentCycleId) || null;
    const open = await readOpenLedger(tx, db, subscriberId, cycleId);

    prevPaidUSD = asNumber(current.paidAmountUSD);
    const totalPriceUSD = asNumber(current.totalPriceUSD);
    const refundUSD = asNumber(current.refundAmountUSD);
    const lockedRate = asNumber(current.lockedRate, 1);

    newPaidUSD = prevPaidUSD + amountUSD;

    if (newPaidUSD < 0) {
      throw new Error(
        `التسوية تجعل المدفوع بالسالب — المدفوع حالياً $${prevPaidUSD.toFixed(2)}. ` +
        `استخدم الاسترداد إذا عادت النقود للعميل فعلاً.`
      );
    }
    if (totalPriceUSD > 0 && newPaidUSD > totalPriceUSD + 0.01) {
      throw new Error(
        `التسوية تتجاوز إجمالي الاشتراك — المدفوع بعدها $${newPaidUSD.toFixed(2)}, الإجمالي $${totalPriceUSD.toFixed(2)}`
      );
    }

    const result = stageLedgerAdjustment(tx, db, {
      invoice: open.invoice, cycleId, amountUSD, actorUid: user.uid, today,
    });
    invoiceStatus = result.invoiceStatus;

    const convincedByUid = asString(current.convincedByUid);
    tx.set(adjRef, {
      subscriberId,
      subscriberName,
      // Denormalised so firestore.rules scopes the adjustment to the same
      // employee who can already see the payment it corrects.
      ...(convincedByUid ? { convincedByUid } : {}),
      paymentId: asString(payload.paymentId) || null,
      invoiceId: open.invoice?.id ?? null,
      cycleId,
      adjustmentType,
      amountUSD,
      amountOriginal: amountUSD * exchangeRate,
      currencyOriginal: asString(payload.currencyOriginal, asString(current.currencyOriginal, "USD")),
      exchangeRate,
      reason,
      notes: asString(payload.notes).trim() || null,
      // Recorded rather than enforced: the threshold makes a large write-off a
      // deliberate act with a name attached, it does not block one.
      approvedByName: Math.abs(amountUSD) >= ADJUSTMENT_APPROVAL_THRESHOLD_USD
        ? (asString(payload.approvedByName).trim() || actorName(user))
        : null,
      approvedBy: Math.abs(amountUSD) >= ADJUSTMENT_APPROVAL_THRESHOLD_USD ? user.uid : null,
      date,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
      createdByName: actorName(user),
    });

    const remainingAmountUSD = Math.max(0, totalPriceUSD - newPaidUSD);
    tx.update(subRef, {
      paidAmountUSD:      newPaidUSD,
      paidAmount:         newPaidUSD * lockedRate,
      remainingAmountUSD,
      remainingAmount:    remainingAmountUSD * lockedRate,
      netAmountUSD:       Math.max(0, newPaidUSD - refundUSD),
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit(user, "payment_adjusted", {
    category: "financial",
    severity: "warning",
    entityType: "payment",
    entityId: adjRef.id,
    entityName: subscriberName,
    description: `تسوية ${adjustmentType} بمقدار $${amountUSD.toFixed(2)} — ${subscriberName}: ${reason}`,
    financialData: {
      amount: Math.abs(amountUSD),
      currency: "USD",
      amountUSD: Math.abs(amountUSD),
      impactType: amountUSD < 0 ? "negative" : "positive",
    },
    previousData: { paidAmountUSD: prevPaidUSD },
    newData:      { paidAmountUSD: newPaidUSD },
    changedFields: ["paidAmountUSD", "remainingAmountUSD", "netAmountUSD"],
    metadata: { subscriberId, adjustmentType, reason, paymentId: asString(payload.paymentId) || null },
  });

  return { success: true, adjustmentId: adjRef.id, paidAmountUSD: newPaidUSD, invoiceStatus };
}
