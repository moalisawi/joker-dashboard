import type { Subscriber, SubscriberStatus } from "@/types";

export const ARABIC_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export function formatNumber(num: number | undefined | null, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(num || 0));
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ar-EG-u-nu-latn", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: unknown): string {
  if (!value) return "-";
  let date: Date;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    date = (value as { toDate: () => Date }).toDate();
  } else if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    date = new Date(value as string);
  }
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-EG-u-nu-latn", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calculateExpiry(startDate: string, days: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + Number(days || 0));
  return start.toISOString().split("T")[0];
}

/**
 * Whole days from today until `expiryDate` (YYYY-MM-DD). 0 on the expiry day,
 * negative once past.
 *
 * Both sides must be compared in the same frame. `new Date("2026-06-10")` is
 * parsed as *UTC* midnight while `today` is *local* midnight, so the two differ
 * by the UTC offset — which pushed every countdown a day out in any timezone
 * ahead of UTC (Palestine, Egypt, Jordan among them): a subscription expiring
 * today read as "1 day left", and an expired one sat at "ينتهي قريباً" for an
 * extra day instead of flipping to "منتهي". The date is therefore built from its
 * parts as a local calendar date.
 *
 * Math.round rather than ceil: DST changes make some local days 23 or 25 hours
 * long, and rounding keeps those days counting as one.
 */
export function getDaysRemaining(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = String(expiryDate).split("-").map(Number);
  const expiry =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(year, month - 1, day)
      : new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getComputedStatus(s: {
  subscriptionState: string;
  subscriptionStatus?: string;
  daysRemaining: number;
}): SubscriberStatus {
  if (s.subscriptionState === "withdrawn") return "منسحب";
  if (s.subscriptionStatus === "frozen")   return "متجمد";
  if (s.subscriptionStatus === "paused")   return "موقوف";
  if (s.daysRemaining < 0)  return "منتهي";
  if (s.daysRemaining <= 7) return "ينتهي قريباً";
  return "نشط";
}

export function isPaused(s: { subscriptionStatus?: string }): boolean {
  return s.subscriptionStatus === "paused";
}

/** Days since a Firestore Timestamp (or ISO string) until today */
export function daysSince(value: unknown): number {
  if (!value) return 0;
  let ms: number;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    ms = (value as { toMillis: () => number }).toMillis();
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    ms = (value as { seconds: number }).seconds * 1000;
  } else {
    ms = new Date(value as string).getTime();
  }
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
}

export function normalizeSubscriber(raw: Record<string, unknown> & { id: string }): Subscriber {
  const expiryDate =
    (raw.expiryDate as string) ||
    calculateExpiry(raw.date as string, Number(raw.duration || 0));
  const daysRemaining = getDaysRemaining(expiryDate);
  const lockedRate = Number(raw.lockedRate || 1);
  const amount = Number(raw.amount || 0);
  const amountUSD = Number(raw.amountUSD || amount / lockedRate);
  const totalPrice = Number(raw.totalPrice ?? amount);
  const totalPriceUSD = Number(raw.totalPriceUSD ?? amountUSD);

  const paidAmountUSD = Number(
    raw.paidAmountUSD !== undefined ? raw.paidAmountUSD : amountUSD
  );
  const paidAmount = Number(
    raw.paidAmount !== undefined ? raw.paidAmount : paidAmountUSD * lockedRate
  );
  const remainingAmountUSD = Number(
    raw.remainingAmountUSD !== undefined
      ? raw.remainingAmountUSD
      : Math.max(0, totalPriceUSD - paidAmountUSD)
  );
  const refundAmount = Number(raw.refundAmount || 0);
  const refundRate = Number(raw.refundRate || 1);
  const refundAmountUSD = Number(
    raw.refundAmountUSD || refundAmount / refundRate
  );
  const netAmountUSD = Math.max(
    0,
    Number(raw.netAmountUSD ?? paidAmountUSD - refundAmountUSD)
  );

  const normalized: Subscriber = {
    id: raw.id,
    date: (raw.date as string) || (raw.startDate as string) || "",
    startDate: (raw.startDate as string) || (raw.date as string) || "",
    // Falls back to the cycle start only for records written before this
    // existed. For those, the first cycle IS the acquisition, so the two agree.
    firstSubscribedAt:
      (raw.firstSubscribedAt as string) || (raw.date as string) || (raw.startDate as string) || "",
    name: (raw.name as string) || "",
    residence: (raw.residence as string) || (raw.country as string) || "",
    phoneCountry: (raw.phoneCountry as string) || "",
    dialCode: (raw.dialCode as string) || "",
    phone: (raw.phone as string) || "",
    phoneE164: (raw.phoneE164 as string | null) ?? null,
    age: raw.age as number | null,
    // Extended profile. Stored on every signup since the form gained these
    // boxes, and dropped here on the way back, so nothing could show them.
    gender: (raw.gender as "male" | "female" | null) ?? null,
    height: raw.height != null ? Number(raw.height) : null,
    weight: raw.weight != null ? Number(raw.weight) : null,
    goal:   (raw.goal as string | null) ?? null,
    package: (raw.package as "فضية" | "ذهبية") || "فضية",
    duration: Number(raw.duration || 0),
    expiryDate,
    daysRemaining,
    status: "نشط",
    currencyOriginal: (raw.currencyOriginal as "USD") || "USD",
    currency: (raw.currency as "USD") || "USD",
    lockedRate,
    totalPrice,
    totalPriceUSD,
    paidAmount,
    paidAmountUSD,
    remainingAmount: Number(raw.remainingAmount ?? paidAmount),
    remainingAmountUSD,
    netAmountUSD,
    payment: (raw.payment as string) || "",
    paymentMethodId: (raw.paymentMethodId as string | null) ?? null,
    source: (raw.source as string) || "",
    sourceDetail: (raw.sourceDetail as string | null) ?? null,
    referrer: (raw.referrer as string) || "",
    convincedBy: (raw.convincedBy as string) || "",
    convincedByUid: (raw.convincedByUid as string | null) ?? null,
    paidShift: (raw.paidShift as string) || "",
    team: (raw.team as string) || "",
    teamId:   (raw.teamId as string | null) ?? null,
    teamName: (raw.teamName as string | null) ?? null,
    notes: (raw.notes as string) || "",
    subscriptionState:
      (raw.subscriptionState as "active" | "withdrawn") || "active",
    refundAmount,
    refundAmountUSD,
    refundCurrency: raw.refundCurrency as "USD" | undefined,
    refundRate,
    withdrawnAt: raw.withdrawnAt as string | undefined,
    withdrawalReason: raw.withdrawalReason as string | undefined,
    // Pause system
    subscriptionStatus: (raw.subscriptionStatus as import("../types").SubscriptionStatus) || "active",
    pausedAt:              raw.pausedAt as import("firebase/firestore").Timestamp | null ?? null,
    pausedBy:              raw.pausedBy as string | null ?? null,
    pauseReason:           raw.pauseReason as string | null ?? null,
    remainingDaysAtPause:  raw.remainingDaysAtPause != null ? Number(raw.remainingDaysAtPause) : null,
    totalPausedDays:       Number(raw.totalPausedDays || 0),
    // Freeze system
    freezeData: raw.freezeData as import("../types").FreezeData | undefined,
    // Withdrawal system
    withdrawalData: raw.withdrawalData as import("../types/withdrawal").WithdrawalData | undefined,
    // Renewal lifecycle (new system)
    renewals: (raw.renewals as import("../types").RenewalSnapshot[]) || [],
    renewalCount: Number(raw.renewalCount || 0),
    lifetimeValueUSD: Number(raw.lifetimeValueUSD ?? paidAmountUSD),
    lastRenewalDate: (raw.lastRenewalDate as import("firebase/firestore").Timestamp | null) ?? null,
    // Legacy flags
    isRenewal: Boolean(raw.isRenewal),
    renewalOf: raw.renewalOf as string | undefined,
    isUpgrade: Boolean(raw.isUpgrade),
    isDowngrade: Boolean(raw.isDowngrade),
    originalTeam: raw.originalTeam as string | undefined,
    originalConvincedBy: raw.originalConvincedBy as string | undefined,
    renewedBy: raw.renewedBy as string | undefined,
    createdAt: raw.createdAt as import("firebase/firestore").Timestamp | undefined,
    createdBy: raw.createdBy as string | undefined,
    updatedAt: raw.updatedAt as import("firebase/firestore").Timestamp | undefined,
    updatedBy: raw.updatedBy as string | undefined,

    /*
     * Soft delete. Carried through deliberately, and the reason is worth stating.
     *
     * This normaliser builds its result field by field rather than spreading
     * `raw`, so anything not named here is silently dropped. `deleted` was not
     * named — which turned every guard in the client into a no-op, because
     * `undefined !== true` is true:
     *
     *   .filter((s) => s.deleted !== true)   // kept everything
     *
     * Soft delete is this project's only delete, so the effect was that deleting
     * a subscriber did nothing visible at all: archived records kept counting in
     * the dashboard totals and kept appearing in the activity feed as new
     * sign-ups. Found 31 Aug 2026 on production, where the header read 55
     * subscribers against 51 undeleted ones.
     *
     * Any new field added to the Subscriber type has to be added here too.
     */
    deleted:   Boolean(raw.deleted),
    deletedAt: raw.deletedAt as import("firebase/firestore").Timestamp | undefined,
    deletedBy: raw.deletedBy as string | undefined,

    /*
     * ── Workflow, assignment and ledger pointers ──────────────────────────
     *
     * These 23 fields were declared on the Subscriber type and never copied
     * here, so every consumer read `undefined` no matter what Firestore held.
     * Because this normaliser builds its result field by field instead of
     * spreading `raw`, a forgotten field is silently absent — it does not throw,
     * it just makes every feature that depends on it quietly do nothing.
     *
     * Three separate bugs traced back to exactly this, and all three looked like
     * different problems:
     *
     *   • /sales scored every employee 0 subscribers and $0 — it matched on
     *     assignedSalesId. The page was dropped from the navigation rather than
     *     debugged.
     *   • The team leaderboard scored every team zero — assignedTeamId.
     *   • The outcome buttons on /today wrote renewalWorkflowStatus to Firestore
     *     correctly and the list never changed, because the value never came
     *     back. Shipped in that state earlier today.
     *
     * The deleted flag was the fourth, fixed separately this morning.
     *
     * Any field added to the Subscriber type has to be added here too. That is a
     * real weakness of this design, and the reason it is written down.
     */
    withdrawalDate: (raw.withdrawalDate as import("firebase/firestore").Timestamp | null) ?? null,

    currentCycleId:     (raw.currentCycleId as string | null) ?? null,
    currentCycleNumber: raw.currentCycleNumber != null ? Number(raw.currentCycleNumber) : undefined,
    currentInvoiceId:   (raw.currentInvoiceId as string | null) ?? null,
    paymentPlanType:    raw.paymentPlanType as import("../types/billing").PaymentPlanType | undefined,

    assignedSalesId:          (raw.assignedSalesId as string | null) ?? null,
    assignedSalesName:        (raw.assignedSalesName as string | null) ?? null,
    assignedNutritionistId:   (raw.assignedNutritionistId as string | null) ?? null,
    assignedNutritionistName: (raw.assignedNutritionistName as string | null) ?? null,
    assignedTeamId:           (raw.assignedTeamId as string | null) ?? null,
    assignedTeamName:         (raw.assignedTeamName as string | null) ?? null,
    assignmentType:    raw.assignmentType as import("../constants/subscriberWorkflow").AssignmentType | undefined,
    assignmentHistory: (raw.assignmentHistory as import("../types/subscriberWorkflow").AssignmentHistoryEntry[]) ?? undefined,

    workflowStatus:          raw.workflowStatus as import("../constants/subscriberWorkflow").WorkflowStatus | undefined,
    workflowStatusChangedAt: raw.workflowStatusChangedAt as import("firebase/firestore").Timestamp | undefined,
    workflowStatusChangedBy: raw.workflowStatusChangedBy as string | undefined,
    workflowStatusNote:      raw.workflowStatusNote as string | undefined,

    renewalWorkflowStatus:  raw.renewalWorkflowStatus as import("../constants/subscriberWorkflow").RenewalWorkflowStatus | undefined,
    renewalSuggestedBy:     (raw.renewalSuggestedBy as string | null) ?? null,
    renewalSuggestedByName: (raw.renewalSuggestedByName as string | null) ?? null,
    renewalHandledBy:       (raw.renewalHandledBy as string | null) ?? null,
    renewalHandledByName:   (raw.renewalHandledByName as string | null) ?? null,
    renewalNote:            raw.renewalNote as string | undefined,
  };
  normalized.status = getComputedStatus({
    ...normalized,
    subscriptionStatus: normalized.subscriptionStatus,
  });
  return normalized;
}

export function getWhatsAppLink(dialCode: string, phone: string): string {
  const clean = (dialCode + phone).replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}`;
}

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export const RESIDENCE_COUNTRIES = [
  { name: "قطاع غزة", value: "فلسطين-غزة" },
  { name: "الضفة الغربية", value: "فلسطين-الضفة" },
  { name: "عرب الداخل", value: "فلسطين-الداخل" },
];

export const PHONE_COUNTRIES = [
  ["أفغانستان","AF","+93"],["ألبانيا","AL","+355"],["الجزائر","DZ","+213"],["مصر","EG","+20"],
  ["العراق","IQ","+964"],["الأردن","JO","+962"],["الكويت","KW","+965"],["لبنان","LB","+961"],
  ["ليبيا","LY","+218"],["المغرب","MA","+212"],["عمان","OM","+968"],["فلسطين","PS","+970"],
  ["الداخل / إسرائيل","IL","+972"],["قطر","QA","+974"],["السعودية","SA","+966"],["سوريا","SY","+963"],
  ["تونس","TN","+216"],["الإمارات","AE","+971"],["اليمن","YE","+967"],["البحرين","BH","+973"],
  ["تركيا","TR","+90"],["ألمانيا","DE","+49"],["فرنسا","FR","+33"],["المملكة المتحدة","GB","+44"],
  ["الولايات المتحدة","US","+1"],["كندا","CA","+1"],["أستراليا","AU","+61"],["هولندا","NL","+31"],
  ["السويد","SE","+46"],["النرويج","NO","+47"],["الدنمارك","DK","+45"],["سويسرا","CH","+41"],
  ["إسبانيا","ES","+34"],["إيطاليا","IT","+39"],["البرتغال","PT","+351"],["بلجيكا","BE","+32"],
  ["النمسا","AT","+43"],["بولندا","PL","+48"],["رومانيا","RO","+40"],["اليونان","GR","+30"],
  ["روسيا","RU","+7"],["أوكرانيا","UA","+380"],["باكستان","PK","+92"],["الهند","IN","+91"],
  ["بنغلاديش","BD","+880"],["ماليزيا","MY","+60"],["إندونيسيا","ID","+62"],["الفلبين","PH","+63"],
  ["الصين","CN","+86"],["اليابان","JP","+81"],["كوريا الجنوبية","KR","+82"],["كازاخستان","KZ","+7"],
  ["نيجيريا","NG","+234"],["غانا","GH","+233"],["كينيا","KE","+254"],["إثيوبيا","ET","+251"],
  ["جنوب أفريقيا","ZA","+27"],["السودان","SD","+249"],["الصومال","SO","+252"],["المكسيك","MX","+52"],
  ["البرازيل","BR","+55"],["الأرجنتين","AR","+54"],["كولومبيا","CO","+57"],
].map(([name, iso, dialCode]) => ({ name, iso, dialCode }));

/**
 * Get comprehensive financial summary for a subscriber
 * Combines transaction data with legacy data for backward compatibility
 */
export interface SubscriberFinancialSummary {
  subscriberId: string;
  totalPriceUSD: number;
  paidAmountUSD: number;
  previousRefundsTotal: number;
  remainingBalanceUSD: number;
  status: "active" | "withdrawn";
}

export function getSubscriberFinancialSummary(
  subscriber: Subscriber,
  previousRefunds: Array<{ refundAmountUSD: number }> = []
): SubscriberFinancialSummary {
  const previousRefundsTotal = previousRefunds.reduce(
    (sum, r) => sum + (r.refundAmountUSD || 0),
    0
  );

  return {
    subscriberId: subscriber.id,
    totalPriceUSD: subscriber.totalPriceUSD || 0,
    paidAmountUSD: subscriber.paidAmountUSD || 0,
    previousRefundsTotal,
    remainingBalanceUSD: Math.max(
      0,
      (subscriber.paidAmountUSD || 0) - previousRefundsTotal
    ),
    status: subscriber.subscriptionState as "active" | "withdrawn",
  };
}

/**
 * Calculate net amount USD using transaction-based approach
 * If refunds collection exists, ignore legacy refundAmountUSD
 */
export function calculateNetAmountUSD(
  subscriber: Subscriber,
  previousRefundsTotal: number = 0
): number {
  return Math.max(
    0,
    (subscriber.paidAmountUSD || 0) - previousRefundsTotal
  );
}
