import { NextResponse } from "next/server";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { createServerNotification } from "@/lib/serverNotification";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
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

const DAY_MS = 1000 * 60 * 60 * 24;

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysUsed(startDate: string, toDate = todayString()) {
  return Math.max(0, Math.floor((new Date(toDate).getTime() - new Date(startDate).getTime()) / DAY_MS));
}

function remainingDays(expiryDate: string, fromDate = todayString()) {
  return Math.max(0, Math.ceil((new Date(expiryDate).getTime() - new Date(fromDate).getTime()) / DAY_MS));
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
  const exchangeRate = Math.max(asNumber(initialPayment.exchangeRate, asNumber(subscriber.lockedRate, 1)), 0.000001);
  const amountUSD = amountOriginal / exchangeRate;
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
  if (convincedByUid) safeSubscriber.convincedByUid = convincedByUid;

  await db.runTransaction(async (tx) => {
    tx.set(subRef, {
      ...safeSubscriber,
      // حفظ startDate صراحةً لضمان اتساق البيانات مع renewals
      startDate: asString(safeSubscriber.startDate) || asString(safeSubscriber.date) || todayString(),
      subscriptionState: "active",
      paidAmountUSD: 0,
      totalPriceUSD: asNumber(safeSubscriber.totalPriceUSD),
      remainingAmountUSD: asNumber(safeSubscriber.totalPriceUSD),
      netAmountUSD: 0,
      lifetimeValueUSD: 0,
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
  const exchangeRate = Math.max(asNumber(payload.exchangeRate, 1), 0.000001);
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
    const paidAmountUSD = prevPaidUSD + amountUSD;
    const totalPriceUSD = asNumber(current.totalPriceUSD);
    const refundAmountUSD = asNumber(current.refundAmountUSD);
    const lockedRate = asNumber(current.lockedRate, 1);

    if (totalPriceUSD > 0 && paidAmountUSD > totalPriceUSD + 0.01) {
      throw new Error(
        `المبلغ يتجاوز الإجمالي — المدفوع: $${paidAmountUSD.toFixed(2)}, الإجمالي: $${totalPriceUSD.toFixed(2)}`
      );
    }

    const remainingAmountUSD = Math.max(0, totalPriceUSD - paidAmountUSD);

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

    newPaidUSD = paidAmountUSD;
    newRemainingUSD = remainingAmountUSD;

    tx.update(subRef, {
      paidAmountUSD,
      paidAmount: paidAmountUSD * lockedRate,
      remainingAmountUSD,
      remainingAmount: remainingAmountUSD * lockedRate,
      netAmountUSD: Math.max(0, paidAmountUSD - refundAmountUSD),
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
  const totalPrice = asNumber(payload.totalPrice);
  const exchangeRate = Math.max(asNumber(payload.exchangeRate, 1), 0.000001);
  const totalPriceUSD = totalPrice / exchangeRate;
  const paidAmount = payload.paidAmount == null ? totalPrice : asNumber(payload.paidAmount);
  const paidUSD = paidAmount / exchangeRate;
  const remaining = Math.max(0, totalPrice - paidAmount);
  const remainingUSD = remaining / exchangeRate;
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
    const oldExpiryDate = asString(current.expiryDate, renewalDate);
    const startDate = !isWithdrawn && remainingDays(oldExpiryDate, renewalDate) > 0 ? oldExpiryDate : renewalDate;
    const endDate = addDays(startDate, duration);
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
      netAmountUSD: Math.max(0, paidUSD),
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
  const exchangeRate = Math.max(asNumber(payload.exchangeRate, 1), 0.000001);
  const refundAmountUSD = refundAmount > 0 ? refundAmount / exchangeRate : 0;
  const hasRefund = refundAmountUSD > 0;
  const subRef = db.collection("subscribers").doc(subscriberId);
  const refundRef = db.collection("refunds").doc();
  let subscriberName = "";
  let prevState: Record<string, unknown> = {};

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
    const newRefundAmountUSD = previousRefundUSD + refundAmountUSD;

    if (hasRefund) {
      tx.set(refundRef, {
        subscriberId,
        subscriberName,
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
      refundAmountUSD: newRefundAmountUSD,
      netAmountUSD: Math.max(0, asNumber(current.paidAmountUSD) - newRefundAmountUSD),
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
    const remaining = Math.max(0, asNumber(current.daysRemaining, remainingDays(asString(current.expiryDate, todayString()))));
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
    preservedDays = remainingDays(asString(current.expiryDate, todayString()));
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
    newExpiryDate = addDays(todayString(), preservedDays);
    const pausedAt = current.pausedAt instanceof Timestamp ? current.pausedAt.toDate() : null;
    pausedDays = pausedAt ? Math.ceil((Date.now() - pausedAt.getTime()) / DAY_MS) : 0;
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
    newExpiryDate = addDays(todayString(), preservedDays);
    const frozenAt = freezeData.frozenAt instanceof Timestamp ? freezeData.frozenAt.toDate() : null;
    frozenDays = frozenAt ? Math.ceil((Date.now() - frozenAt.getTime()) / DAY_MS) : 0;

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
