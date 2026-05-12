import { NextResponse } from "next/server";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

type Operation =
  | "createSubscriber"
  | "updateSubscriber"
  | "deleteSubscriber"
  | "addPayment"
  | "renewSubscription"
  | "withdrawSubscriber"
  | "pauseSubscription"
  | "resumePausedSubscription"
  | "freezeSubscription"
  | "resumeSubscription";

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
    previousData: null,
    newData: null,
    changedFields: [],
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
  let user: ServerUser;
  try {
    user = await verifyServerUser(request);
  } catch (err) {
    console.error("[subscriber-operations] auth failed:", err);
    return jsonError("Unauthorized", 401);
  }

  if (!user) return jsonError("Unauthorized", 401);

  let body: OperationBody;
  try {
    body = (await request.json()) as OperationBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.operation) return jsonError("Missing operation", 400);
  if (!requirePermission(user, body.operation)) return jsonError("Forbidden", 403);

  const payload = asRecord(body.payload);

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
    return jsonError(message, 500);
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

  await db.runTransaction(async (tx) => {
    tx.set(subRef, {
      ...subscriber,
      subscriptionState: "active",
      refundAmount: 0,
      refundAmountUSD: 0,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (amountOriginal > 0) {
      tx.set(paymentRef, {
        subscriberId: subRef.id,
        subscriberName: asString(subscriber.name),
        amountOriginal,
        currencyOriginal: asString(initialPayment.currencyOriginal, asString(subscriber.currencyOriginal, "USD")),
        exchangeRate,
        amountUSD,
        paymentMethod: asString(initialPayment.paymentMethod, asString(subscriber.payment)),
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
  const update = asRecord(payload.subscriber);
  const ref = db.collection("subscribers").doc(subscriberId);

  await ref.update({
    ...update,
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit(user, "subscriber_updated", {
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: asString(update.name),
    description: `Updated subscriber: ${asString(update.name, subscriberId)}`,
  });

  return { success: true };
}

async function deleteSubscriber(user: NonNullable<ServerUser>, payload: Record<string, unknown>) {
  const db = getFirestore();
  const subscriberId = asString(payload.subscriberId);
  if (!subscriberId) throw new Error("Missing subscriberId");
  const ref = db.collection("subscribers").doc(subscriberId);
  const snap = await ref.get();
  const name = asString(snap.data()?.name, asString(payload.subscriberName, subscriberId));

  await ref.delete();
  await writeAudit(user, "subscriber_deleted", {
    severity: "critical",
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: name,
    description: `Deleted subscriber: ${name}`,
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    const paidAmountUSD = asNumber(current.paidAmountUSD) + amountUSD;
    const totalPriceUSD = asNumber(current.totalPriceUSD);
    const refundAmountUSD = asNumber(current.refundAmountUSD);
    const lockedRate = asNumber(current.lockedRate, 1);
    const remainingAmountUSD = Math.max(0, totalPriceUSD - paidAmountUSD);

    tx.set(paymentRef, {
      subscriberId,
      subscriberName,
      amountOriginal,
      currencyOriginal: asString(payload.currencyOriginal, "USD"),
      exchangeRate,
      amountUSD,
      paymentMethod: asString(payload.paymentMethod),
      receiptUrl: payload.receiptUrl ?? null,
      date: asString(payload.date, todayString()),
      notes: asString(payload.notes).trim() || null,
      isInitialPayment: false,
      isRenewalPayment: false,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
    });

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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    const isWithdrawn = asString(current.subscriptionState) === "withdrawn";
    const oldExpiryDate = asString(current.expiryDate, renewalDate);
    const startDate = !isWithdrawn && remainingDays(oldExpiryDate, renewalDate) > 0 ? oldExpiryDate : renewalDate;
    const endDate = addDays(startDate, duration);
    const renewals = Array.isArray(current.renewals) ? current.renewals : [];
    renewalNumber = asNumber(current.renewalCount) + 1;

    const snapshot = {
      package: current.package,
      startDate: current.startDate || current.date || "",
      endDate: current.expiryDate || "",
      duration: asNumber(current.duration),
      totalPrice: asNumber(current.totalPrice),
      totalPriceUSD: asNumber(current.totalPriceUSD),
      paidAmountUSD: asNumber(current.paidAmountUSD),
      remainingAmountUSD: asNumber(current.remainingAmountUSD),
      netAmountUSD: asNumber(current.netAmountUSD),
      currency: current.currencyOriginal || "USD",
      lockedRate: asNumber(current.lockedRate, 1),
      payment: current.payment || "",
      convincedBy: current.convincedBy || "",
      paidShift: current.paidShift || "",
      snapshotStatus: isWithdrawn ? "withdrawn" : "active",
      renewedAt: null,
      renewedBy: user.uid,
      renewedByName: actorName(user),
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
      renewals: [...renewals, snapshot],
      renewalCount: renewalNumber,
      lifetimeValueUSD: asNumber(current.lifetimeValueUSD, asNumber(current.paidAmountUSD)) + paidUSD,
      lastRenewalDate: FieldValue.serverTimestamp(),
      withdrawnAt: null,
      withdrawalReason: null,
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (paidAmount > 0) {
      tx.set(paymentRef, {
        subscriberId,
        subscriberName,
        amountOriginal: paidAmount,
        currencyOriginal: currency,
        exchangeRate,
        amountUSD: paidUSD,
        paymentMethod: asString(payload.paymentMethod),
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new Error("Subscriber not found");
    const current = snap.data() ?? {};
    subscriberName = asString(current.name, subscriberId);
    if (asString(current.subscriptionState) === "withdrawn") throw new Error("Subscription is already withdrawn");
    const today = todayString();
    const previousRefundUSD = asNumber(current.refundAmountUSD);
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
        originalPlan: current.package,
        originalExpiryDate: current.expiryDate,
        previousStatus: current.status,
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

  await writeAudit(user, "subscriber_resumed", {
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

  await writeAudit(user, "subscriber_resumed", {
    entityType: "subscriber",
    entityId: subscriberId,
    entityName: subscriberName,
    description: `Resumed subscription: ${subscriberName}`,
    metadata: { frozenDays, preservedDays, newExpiryDate },
  });

  return { success: true, newExpiryDate };
}
