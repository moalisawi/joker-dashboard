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
import { z } from "zod";

export const runtime = "nodejs";

// ── Zod schemas for each operation payload ────────────────────────────────────

const subscriberIdSchema = z.string().min(1, "subscriberId is required");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional();
const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().min(0);
const currencySchema = z.string().min(1).max(10);

const subscriberCoreSchema = z.object({
  name:             z.string().min(1, "Name is required").max(200),
  phone:            z.string().max(50).optional().nullable(),
  package:          z.string().max(200).optional().nullable(),
  duration:         z.number().int().positive().optional(),
  source:           z.string().max(100).optional().nullable(),
  convincedBy:      z.string().max(200).optional().nullable(),
  convincedByUid:   z.string().max(128).optional().nullable(),
  paidShift:        z.string().max(200).optional().nullable(),
  notes:            z.string().max(2000).optional().nullable(),
  date:             dateSchema,
  startDate:        dateSchema,
  expiryDate:       dateSchema,
  currencyOriginal: currencySchema.optional(),
  lockedRate:       z.number().positive().optional(),
  totalPrice:       nonNegativeNumber.optional(),
  totalPriceUSD:    nonNegativeNumber.optional(),
  payment:          z.string().max(100).optional().nullable(),
  paymentMethodId:  z.string().max(100).optional().nullable(),
  gender:           z.enum(["male","female"]).optional().nullable(),
  age:              z.number().int().min(1).max(150).optional().nullable(),
  teamId:           z.string().optional().nullable(),
  teamName:         z.string().max(200).optional().nullable(),
  // Extended profile fields
  residence:        z.string().max(100).optional().nullable(),
  phoneCountry:     z.string().max(10).optional().nullable(),
  dialCode:         z.string().max(10).optional().nullable(),
  phoneE164:        z.string().max(20).optional().nullable(),
  height:           z.number().positive().optional().nullable(),
  weight:           z.number().positive().optional().nullable(),
  goal:             z.string().max(500).optional().nullable(),
  referrer:         z.string().max(200).optional().nullable(),
  sourceDetail:     z.string().max(200).optional().nullable(),
  assignedSalesId:          z.string().max(128).optional().nullable(),
  assignedSalesName:        z.string().max(200).optional().nullable(),
  assignedNutritionistId:   z.string().max(128).optional().nullable(),
  assignedNutritionistName: z.string().max(200).optional().nullable(),
  assignedTeamId:           z.string().max(128).optional().nullable(),
  assignedTeamName:         z.string().max(200).optional().nullable(),
  assignmentType:           z.string().max(50).optional().nullable(),
});

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
    receiptUrl:       z.string().url().optional().nullable(),
  }).optional().nullable(),
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
  receiptUrl:       z.string().url().optional().nullable(),
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

// Fields that may be set/updated by the client.
// Financial fields are intentionally excluded — they are only mutated
// through their dedicated operations (addPayment, renewSubscription, etc.).
const SUBSCRIBER_WRITABLE_FIELDS = new Set([
  "name", "phone", "package", "duration", "source", "convincedBy", "convincedByUid",
  "paidShift", "notes", "teamId", "teamName",
  "assignedSalesId", "assignedSalesName",
  "assignedNutritionistId", "assignedNutritionistName",
  "assignedTeamId", "assignedTeamName", "assignmentType",
  "date", "startDate", "expiryDate",
  "currencyOriginal", "lockedRate",
  "totalPrice", "totalPriceUSD",
  "status", "subscriptionStatus",
  "gender", "age", "height", "weight", "goal",
  "paymentMethodId", "payment",
]);

function pickWritableFields(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).filter(([k]) => SUBSCRIBER_WRITABLE_FIELDS.has(k))
  );
}

function actorName(user: NonNullable<ServerUser>) {
  return user.email || user.uid;
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
      default:
        return jsonError("Unknown operation", 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[subscriber-operations] operation failed:", message);
    // Authorization failures thrown from inside a handler carry their own status
    // so they answer 403 rather than the 500 a bare throw would produce.
    const status = (err as { status?: number })?.status;
    if (status === 403) return jsonError(message, 403);
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

  await db.runTransaction(async (tx) => {
    tx.set(subRef, {
      ...safeSubscriber,
      // حفظ startDate صراحةً لضمان اتساق البيانات مع renewals
      startDate: asString(safeSubscriber.startDate) || asString(safeSubscriber.date) || todayString(),
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
        currencyOriginal: asString(initialPayment.currencyOriginal, asString(subscriber.currencyOriginal, "USD")),
        exchangeRate,
        amountUSD,
        paymentMethod: asString(initialPayment.paymentMethod, asString(subscriber.payment)),
        ...(initPmId ? { paymentMethodId: initPmId } : {}),
        receiptUrl: initialPayment.receiptUrl ?? null,
        date: asString(initialPayment.date, asString(subscriber.date, todayString())),
        notes: initialPayment.notes ?? null,
        isInitialPayment: true,
        isRenewalPayment: false,
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
    metadata: { hasInitialPayment: amountOriginal > 0 },
  });

  return { success: true, subscriberId: subRef.id };
}

async function updateSubscriber(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");

  // Allow-list: only non-financial, non-system fields may be updated directly.
  const raw = asRecord(payload.subscriber);
  const safeUpdate = pickWritableFields(raw);
  if (Object.keys(safeUpdate).length === 0) throw new Error("No valid fields to update");

  // If convincedBy name is being changed without an explicit UID, resolve it now
  if (safeUpdate.convincedBy && !safeUpdate.convincedByUid) {
    const empSnap = await db.collection("users")
      .where("employeeName", "==", safeUpdate.convincedBy)
      .limit(1)
      .get();
    if (!empSnap.empty) safeUpdate.convincedByUid = empSnap.docs[0].id;
  }

  const ref = db.collection("subscribers").doc(subscriberId);

  // Capture before-state for the audit trail
  const beforeSnap = await ref.get();
  if (!beforeSnap.exists) throw new Error("Subscriber not found");
  const beforeData = beforeSnap.data() ?? {};
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    prevPaidUSD = asNumber(current.paidAmountUSD);
    prevRemainingUSD = asNumber(current.remainingAmountUSD);

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
      date: asString(payload.date, todayString()),
      notes: asString(payload.notes).trim() || null,
      isInitialPayment: false,
      isRenewalPayment: false,
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
    metadata: { subscriberId },
  });

  return { success: true, paymentId: paymentRef.id };
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);

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

    tx.update(subRef, {
      date: startDate,
      startDate,
      expiryDate: endDate,
      duration,
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
        isInitialPayment: false,
        isRenewalPayment: true,
        renewalNumber,
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
    metadata: { renewalNumber },
  });

  return { success: true, paymentId: paidAmount > 0 ? paymentRef.id : null };
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
