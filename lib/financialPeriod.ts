/**
 * A month you can stop changing.
 *
 * Until now nothing in this system could say "May is finished". A payment
 * recorded in September and dated to May moved May's totals months after anyone
 * had looked at them, and no screen, log or number said so. The stored monthly
 * aggregate that was supposed to hold those totals had drifted from the payments
 * it summarised — 12 payments and $900 against 13 and $2,021 — and has been
 * removed rather than repaired, because a second copy of a number is a second
 * thing to be wrong.
 *
 * So a period is not an aggregate. It is a **permission**: may money still be
 * dated into this month? Everything financial stays computed from `payments`,
 * `refunds`, `paymentAdjustments`, the cycles and the invoices, exactly as
 * before. Closing does not store the answer; it stops the question changing.
 *
 * The one thing a close *does* store is a snapshot, and only because recognised
 * revenue is derived from a contract that can still be corrected afterwards.
 * The snapshot is a record of what was reported, never a source of truth — §13.
 *
 * Free of Firestore so every rule below is provable without an emulator.
 */

export type PeriodStatus = "open" | "closed";

/** One close or reopen. Appended, never overwritten — §9. */
export interface PeriodEvent {
  action: "closed" | "reopened";
  at: string;
  by: string;
  byName?: string;
  reason: string;
}

export interface PeriodSnapshot {
  cashUSD: number;
  refundsUSD: number;
  recognizedRevenueUSD: number;
  deferredRevenueUSD: number;
  takenAt: string;
}

export interface FinancialPeriod {
  /** "YYYY-MM" — also the document id. */
  period: string;
  status: PeriodStatus;
  closedAt?: string | null;
  closedBy?: string | null;
  closeReason?: string | null;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
  reopenReason?: string | null;
  /** Append-only history. A second reopen never overwrites the first. */
  events: PeriodEvent[];
  /** What was reported at the moment of the last close. */
  snapshot?: PeriodSnapshot | null;
}

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MIN_PERIOD_REASON_LENGTH = 10;

/** The month a document belongs to — its OWN date, never today's. */
export function periodOf(date: string | null | undefined): string | null {
  if (!date || date.length < 7) return null;
  const p = date.slice(0, 7);
  return PERIOD_PATTERN.test(p) ? p : null;
}

/** Every month a service span touches, inclusive of both ends. */
export function periodsSpanned(startDate: string, durationDays: number): string[] {
  const start = periodOf(startDate);
  if (!start || durationDays <= 0) return start ? [start] : [];
  const [y, m] = start.split("-").map(Number);
  const endMs = Date.UTC(y, m - 1, Number(startDate.slice(8, 10)) || 1) + (durationDays - 1) * 86_400_000;
  const end = new Date(endMs);
  const out: string[] = [];
  let cy = y, cm = m;
  const ey = end.getUTCFullYear(), em = end.getUTCMonth() + 1;
  // Guarded rather than while(true): a bad duration must not spin.
  for (let i = 0; i < 240 && (cy < ey || (cy === ey && cm <= em)); i++) {
    out.push(`${cy}-${String(cm).padStart(2, "0")}`);
    cm += 1;
    if (cm > 12) { cm = 1; cy += 1; }
  }
  return out;
}

export function isClosed(period: FinancialPeriod | null | undefined): boolean {
  return period?.status === "closed";
}

/**
 * May a money document dated here be written?
 *
 * A period with no document is open: months are not created in advance, and an
 * absent record must never read as a locked one — that would freeze the system
 * the day it shipped.
 */
export function canWriteMoneyIn(period: FinancialPeriod | null | undefined): boolean {
  return !isClosed(period);
}

export function backdatedRefusal(period: string, kind: "payment" | "refund" | "invoice"): string {
  const what =
    kind === "payment" ? "دفعة" : kind === "refund" ? "استرداد" : "فاتورة";
  return (
    `الفترة ${period} مغلقة، فلا تُسجَّل فيها ${what} جديدة. ` +
    `التاريخ لا يُحوَّل تلقائياً إلى الشهر الحالي — ذلك يخفي متى حدث المال فعلاً. ` +
    `إن كان التصحيح يخصّ ${period} فسجّله كتسوية في فترة مفتوحة تشير إليها.`
  );
}

/**
 * Corrections that would restate a closed month.
 *
 * Recognition is straight-line across the whole service span, so correcting a
 * price or a duration changes what *every* month in that span earned — not only
 * the month the correction is made in. If one of those months is closed, its
 * snapshot says one number and a fresh computation says another.
 *
 * This refuses rather than choosing between them. Recomputing the snapshot
 * silently is forbidden outright; booking a prior-period restatement instead is
 * a real accounting policy that nobody has decided yet. Reopening the month is
 * already a defined, owner-only, audited act — so that is the path, and no new
 * financial construct gets invented to avoid it.
 */
export function closedPeriodsInSpan(
  startDate: string,
  durationDays: number,
  closedPeriods: ReadonlySet<string>
): string[] {
  return periodsSpanned(startDate, durationDays).filter((p) => closedPeriods.has(p));
}

export function restatementRefusal(periods: string[]): string {
  return (
    `هذا التصحيح يغيّر الإيراد المعترف به في فترة مغلقة (${periods.join("، ")}). ` +
    `الاعتراف موزَّع على كامل مدّة الخدمة، فتغيير السعر أو المدة يعيد حساب كل شهر تمسّه. ` +
    `أعد فتح الفترة أولاً بسبب مكتوب، ثم صحّح، ثم أغلقها من جديد لتُلتقط الأرقام الجديدة.`
  );
}

export interface PeriodActionRefusal {
  field: "period" | "reason" | "status" | "role";
  message: string;
}

/** Closing and reopening share every guard except the one about direction. */
export function refusePeriodAction(
  action: "close" | "reopen",
  period: string,
  reason: string,
  current: FinancialPeriod | null,
  actorRole: string,
  today: string
): PeriodActionRefusal[] {
  const out: PeriodActionRefusal[] = [];

  // Owner only, for both. An admin who could close could end the review of
  // their own month — §10.
  if (actorRole !== "owner") {
    out.push({
      field: "role",
      message: "إغلاق الفترة وإعادة فتحها للمالك وحده — المدير لا يُنهي مراجعة شهره بنفسه.",
    });
  }

  if (!PERIOD_PATTERN.test(period)) {
    out.push({ field: "period", message: "الفترة يجب أن تكون بصيغة YYYY-MM." });
  }

  if (reason.trim().length < MIN_PERIOD_REASON_LENGTH) {
    out.push({
      field: "reason",
      message: `السبب مطلوب ولا يقل عن ${MIN_PERIOD_REASON_LENGTH} أحرف.`,
    });
  }

  if (action === "close") {
    if (isClosed(current)) {
      out.push({ field: "status", message: `الفترة ${period} مغلقة أصلاً.` });
    }
    // A month still running has money yet to arrive in it.
    const currentPeriod = periodOf(today);
    if (currentPeriod && period >= currentPeriod) {
      out.push({
        field: "period",
        message: `لا تُغلق فترة لم تنتهِ بعد (${period}) — ما زال بإمكان مال أن يقع فيها.`,
      });
    }
  } else if (!isClosed(current)) {
    out.push({ field: "status", message: `الفترة ${period} مفتوحة أصلاً.` });
  }

  return out;
}

/** The stored form of a close or reopen, with history appended not replaced. */
export function applyPeriodAction(
  action: "close" | "reopen",
  period: string,
  reason: string,
  current: FinancialPeriod | null,
  actor: { uid: string; name?: string },
  now: string,
  snapshot?: PeriodSnapshot | null
): FinancialPeriod {
  const event: PeriodEvent = {
    action: action === "close" ? "closed" : "reopened",
    at: now,
    by: actor.uid,
    byName: actor.name,
    reason: reason.trim(),
  };

  const events = [...(current?.events ?? []), event];

  if (action === "close") {
    return {
      period,
      status: "closed",
      closedAt: now,
      closedBy: actor.uid,
      closeReason: reason.trim(),
      reopenedAt: current?.reopenedAt ?? null,
      reopenedBy: current?.reopenedBy ?? null,
      reopenReason: current?.reopenReason ?? null,
      events,
      // Retaken on every close, so a reopen-correct-reclose ends up describing
      // the corrected figures rather than the ones that were wrong.
      snapshot: snapshot ?? current?.snapshot ?? null,
    };
  }

  return {
    period,
    status: "open",
    closedAt: current?.closedAt ?? null,
    closedBy: current?.closedBy ?? null,
    closeReason: current?.closeReason ?? null,
    reopenedAt: now,
    reopenedBy: actor.uid,
    reopenReason: reason.trim(),
    events,
    // The snapshot of the last close survives a reopen: it is the record of what
    // was reported, and deleting it would erase the thing being corrected.
    snapshot: current?.snapshot ?? null,
  };
}
