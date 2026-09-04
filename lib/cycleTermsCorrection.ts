import { addDays } from "@/lib/subscriberFinance";

/**
 * Correcting terms that were entered wrong — as an operation, not an edit.
 *
 * A price typed as 500 instead of 50 is a different thing from a payment
 * recorded wrongly, and the two must not share a mechanism. `adjustPayment`
 * writes a signed counter-entry against money that arrived; it moves
 * `paidAmountUSD` and deliberately refuses to let it pass `totalPriceUSD`.
 * Nothing in it can change what was *invoiced*, and forcing it to would make a
 * pricing mistake look like cash that never existed.
 *
 * So this is separate, narrow, owner-and-admin-only, reason-required and
 * audited. It also refuses far more than it allows, because most of the states
 * a subscription can be in make a silent correction unsafe:
 *
 *  • **Instalments exist** — every instalment amount is derived from the total,
 *    the rate and the down payment, and each payment stores which instalment
 *    ids it was applied to. Re-deriving the schedule would delete rows that
 *    payments still point at, and the payments may not be touched. There is no
 *    correct answer here, so price, rate and currency are refused outright.
 *
 *  • **A payment exists** — the rate and currency are refused. A payment stores
 *    the rate it used and its own `amountUSD`; re-denominating the contract
 *    underneath it would leave the record claiming a currency the money never
 *    moved in. The past is not repriced.
 *
 *  • **A refund exists** — the price is refused. The refund was calculated
 *    against the old total; changing it afterwards silently changes what that
 *    refund meant.
 *
 *  • **The subscription was ever frozen or paused** — the duration is refused.
 *    Expiry stopped being `start + duration` the moment days were preserved and
 *    granted again, so recomputing it would quietly revoke the hold.
 *
 * Two fields deliberately have no correction path here:
 *
 *  • `expiryDate` — it is an output. It follows start, duration, freeze, resume
 *    and renewal, and every one of those recomputes it. A box that sets it
 *    directly is a way to grant free service with nothing recording the grant.
 *
 *  • `startDate` / `date` — the code does not settle which of the two owns the
 *    service start. `revenueRecognition` reads `startDate ?? date`, one report
 *    reads the same, and the monthly cohort in `analytics/calculations` reads
 *    `date` alone. Correcting one without settling that would move revenue in
 *    one screen and not another.
 *
 * Everything here is pure. The route reads Firestore, calls this, and writes
 * what comes back — so every rule below is provable without an emulator.
 */

/** The only terms this operation may touch. */
export const CORRECTABLE_TERMS = [
  "totalPriceOriginal",
  "currencyOriginal",
  "lockedRate",
  "duration",
  "package",
] as const;

export type CorrectableTerm = (typeof CORRECTABLE_TERMS)[number];

export type TermChanges = Partial<{
  totalPriceOriginal: number;
  currencyOriginal: string;
  lockedRate: number;
  duration: number;
  package: string;
}>;

/** What the subscription looks like right now, as far as this decision cares. */
export interface CycleTermsState {
  /** Terms as stored. */
  totalPriceOriginal: number;
  currencyOriginal: string;
  lockedRate: number;
  duration: number;
  package: string;
  startDate: string;

  /** Money already recorded against it. */
  paidAmountUSD: number;
  refundAmountUSD: number;

  /** Counts, not contents — presence is what changes the answer. */
  paymentCount: number;
  refundCount: number;
  installmentCount: number;

  /** Lifecycle. A terminal or held subscription is not corrected in place. */
  subscriptionState?: string;
  subscriptionStatus?: string;
  isFrozen?: boolean;
  everHeld?: boolean;
}

export const MIN_REASON_LENGTH = 10;
const EPSILON = 0.005;

export interface CorrectionRefusal {
  field: CorrectableTerm | "reason" | "changes" | "state";
  message: string;
}

/** Rounded to cents, the way every stored money figure in this system is. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function changed(next: unknown, current: unknown): boolean {
  if (next === undefined) return false;
  if (typeof next === "number" && typeof current === "number") {
    return Math.abs(next - current) > EPSILON;
  }
  return String(next) !== String(current);
}

/**
 * Which of the requested changes are real, in a stable order.
 *
 * A request that restates the stored values is not a correction, and treating
 * it as one would write an audit entry describing a change that did not happen.
 */
export function effectiveChanges(changes: TermChanges, state: CycleTermsState): CorrectableTerm[] {
  return CORRECTABLE_TERMS.filter((field) =>
    changed(changes[field], state[field] as unknown)
  );
}

/**
 * Every reason this correction cannot proceed, all of them at once.
 *
 * Returning the full list rather than the first matters: an owner who fixes one
 * refusal and meets the next has been told half the truth twice.
 */
export function refuseCorrection(
  changes: TermChanges,
  state: CycleTermsState,
  reason: string
): CorrectionRefusal[] {
  const out: CorrectionRefusal[] = [];
  const fields = effectiveChanges(changes, state);

  if (reason.trim().length < MIN_REASON_LENGTH) {
    out.push({
      field: "reason",
      message: `سبب التصحيح مطلوب ولا يقل عن ${MIN_REASON_LENGTH} أحرف — التصحيح بلا سبب تعديل صامت.`,
    });
  }

  const unknownFields = Object.keys(changes).filter(
    (k) => !(CORRECTABLE_TERMS as readonly string[]).includes(k)
  );
  if (unknownFields.length > 0) {
    out.push({
      field: "changes",
      message:
        `لا يمكن تصحيح ${unknownFields.join("، ")} بهذه العملية. ` +
        `تاريخ الانتهاء يُحسب من البداية والمدة ويحرّكه التجميد والاستئناف والتجديد وحدها.`,
    });
  }

  if (fields.length === 0 && unknownFields.length === 0) {
    out.push({ field: "changes", message: "لا يوجد تغيير فعلي — القيم المرسلة تطابق المخزَّنة." });
  }

  // ── Lifecycle gates ───────────────────────────────────────────────────────
  if (state.subscriptionState === "withdrawn") {
    out.push({ field: "state", message: "المشترك منسحب — الانسحاب نهائي ولا تُصحَّح شروطه." });
  }
  if (state.isFrozen || state.subscriptionStatus === "frozen" || state.subscriptionStatus === "paused") {
    out.push({
      field: "state",
      message: "الاشتراك موقوف أو مجمّد الآن — استأنفه أولاً، فالاستئناف يعيد حساب تاريخ الانتهاء.",
    });
  }

  const touchesPrice = fields.includes("totalPriceOriginal");
  const touchesMoneyBasis =
    touchesPrice || fields.includes("currencyOriginal") || fields.includes("lockedRate");

  // ── Instalments ───────────────────────────────────────────────────────────
  if (touchesMoneyBasis && state.installmentCount > 0) {
    out.push({
      field: "totalPriceOriginal",
      message:
        `لهذا الاشتراك جدول أقساط (${state.installmentCount}) وكل قسط محسوب من السعر وسعر الصرف. ` +
        `تصحيحها يستلزم إعادة توليد الجدول، والدفعات تشير إلى أقساطه بالمعرّف — ولا تُعدَّل الدفعات.`,
    });
  }

  // ── Payments: the rate and the currency are the past ──────────────────────
  if ((fields.includes("currencyOriginal") || fields.includes("lockedRate")) && state.paymentCount > 0) {
    out.push({
      field: "currencyOriginal",
      message:
        `سُجّلت ${state.paymentCount} دفعة بهذه العملة وسعر الصرف. ` +
        `تغييرهما الآن إعادة تسعير للماضي — الدفعة تحمل السعر الذي استُخدم لحظتها ولا تُعدَّل.`,
    });
  }

  // ── Refunds ───────────────────────────────────────────────────────────────
  if (touchesPrice && state.refundCount > 0) {
    out.push({
      field: "totalPriceOriginal",
      message:
        `سُجّل استرداد على هذا الاشتراك (${state.refundCount}) وحُسب مقابل السعر القديم. ` +
        `تغيير السعر بعده يغيّر معنى الاسترداد بأثر رجعي.`,
    });
  }

  // ── A hold rewrote the expiry once already ────────────────────────────────
  if (fields.includes("duration") && state.everHeld) {
    out.push({
      field: "duration",
      message:
        "سبق أن جُمّد هذا الاشتراك أو أُوقف، فتاريخ الانتهاء لم يعد يساوي البداية زائد المدة. " +
        "إعادة حسابه من المدة تلغي الأيام التي مُنحت عند الاستئناف.",
    });
  }

  // ── A price cannot fall below money already collected ─────────────────────
  if (touchesPrice) {
    const rate = changes.lockedRate ?? state.lockedRate;
    const newTotalUSD = (changes.totalPriceOriginal ?? state.totalPriceOriginal) / (rate > 0 ? rate : 1);
    if (newTotalUSD + EPSILON < state.paidAmountUSD) {
      out.push({
        field: "totalPriceOriginal",
        message:
          `السعر الجديد ($${round2(newTotalUSD)}) أقل ممّا حُصّل فعلاً ($${round2(state.paidAmountUSD)}). ` +
          `إن كان المبلغ الزائد سيعود للعميل فهو استرداد، لا تصحيح سعر.`,
      });
    }
  }

  if (fields.includes("duration") && Number(changes.duration) <= 0) {
    out.push({ field: "duration", message: "مدة الاشتراك يجب أن تكون أكبر من صفر." });
  }
  if (fields.includes("lockedRate") && Number(changes.lockedRate) <= 0) {
    out.push({ field: "lockedRate", message: "سعر الصرف يجب أن يكون أكبر من صفر." });
  }
  if (touchesPrice && Number(changes.totalPriceOriginal) < 0) {
    out.push({ field: "totalPriceOriginal", message: "السعر لا يكون بالسالب." });
  }

  return out;
}

export interface CorrectionResult {
  /** The terms that actually moved, for the audit entry. */
  fields: CorrectableTerm[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  /** Ready to merge onto the subscriber document. */
  subscriberUpdate: Record<string, unknown>;
  /** Ready to merge onto the cycle, when one exists. */
  cycleUpdate: Record<string, unknown>;
  /** Ready to merge onto the invoice, when one exists. */
  invoiceUpdate: Record<string, unknown>;
}

/**
 * The corrected terms and everything that follows from them.
 *
 * Nothing here is a payment, a refund or an adjustment: the money that arrived
 * is untouched, and only what was *owed* moves. `netAmountUSD` is deliberately
 * absent — it is collected minus refunded, and neither of those changed.
 *
 * Call only after `refuseCorrection` returns empty.
 */
export function applyCorrection(
  changes: TermChanges,
  state: CycleTermsState
): CorrectionResult {
  const fields = effectiveChanges(changes, state);

  const totalOriginal = changes.totalPriceOriginal ?? state.totalPriceOriginal;
  const currency = changes.currencyOriginal ?? state.currencyOriginal;
  const rateRaw = changes.lockedRate ?? state.lockedRate;
  const rate = rateRaw > 0 ? rateRaw : 1;
  const duration = changes.duration ?? state.duration;
  const pkg = changes.package ?? state.package;

  const totalUSD = round2(totalOriginal / rate);
  const remainingUSD = Math.max(0, round2(totalUSD - state.paidAmountUSD));
  const remainingOriginal = round2(remainingUSD * rate);
  // Expiry is an output of start and duration — never an input.
  const expiryDate = addDays(state.startDate, duration);

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of fields) {
    before[field] = state[field];
    after[field] = changes[field];
  }
  if (fields.includes("duration")) {
    before.expiryDate = addDays(state.startDate, state.duration);
    after.expiryDate = expiryDate;
  }
  if (fields.includes("totalPriceOriginal") || fields.includes("lockedRate")) {
    before.totalPriceUSD = round2(state.totalPriceOriginal / (state.lockedRate > 0 ? state.lockedRate : 1));
    after.totalPriceUSD = totalUSD;
  }

  return {
    fields,
    before,
    after,
    subscriberUpdate: {
      totalPrice: totalOriginal,
      totalPriceUSD: totalUSD,
      currencyOriginal: currency,
      currency,
      lockedRate: rate,
      duration,
      package: pkg,
      expiryDate,
      remainingAmount: remainingOriginal,
      remainingAmountUSD: remainingUSD,
    },
    cycleUpdate: {
      package: pkg,
      duration,
      expiryDate,
      currencyOriginal: currency,
      listPriceOriginal: totalOriginal,
      totalPriceOriginal: totalOriginal,
      exchangeRate: rate,
      totalPriceUSD: totalUSD,
      remainingAmountUSD: remainingUSD,
    },
    invoiceUpdate: {
      currencyOriginal: currency,
      subtotalOriginal: totalOriginal,
      totalOriginal,
      exchangeRate: rate,
      totalUSD,
      remainingUSD,
    },
  };
}
