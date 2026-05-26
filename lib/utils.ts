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
  return new Date(dateStr).toLocaleDateString("ar-EG", {
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
  return date.toLocaleString("ar-EG", {
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

export function getDaysRemaining(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
    name: (raw.name as string) || "",
    residence: (raw.residence as string) || (raw.country as string) || "",
    phoneCountry: (raw.phoneCountry as string) || "",
    dialCode: (raw.dialCode as string) || "",
    phone: (raw.phone as string) || "",
    age: raw.age as number | null,
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
    source: (raw.source as string) || "",
    referrer: (raw.referrer as string) || "",
    convincedBy: (raw.convincedBy as string) || "",
    convincedByUid: (raw.convincedByUid as string | null) ?? null,
    paidShift: (raw.paidShift as string) || "",
    team: (raw.team as string) || "",
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
