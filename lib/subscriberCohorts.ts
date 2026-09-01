/**
 * The subscriber book, cut into groups you can act on.
 *
 * The page already had status chips, and a chip is a filter: it shows rows. A
 * cohort is a filter that also carries a reason — how many, how much money, and
 * what to do about it. That difference is what turns a list into a decision.
 *
 * The lapsed ladder (7 / 30 / 90 days) is the part that earns its keep. Win-back
 * response falls off sharply with time: someone whose plan ended on Tuesday is a
 * phone call, someone four months gone is a campaign, and treating both as one
 * bucket of "31 منتهي" hides the only distinction that changes what you do. The
 * windows match what the owner asked for — a week, a month, three months.
 *
 * ── The rule that makes the numbers trustworthy ──
 *
 * Cohorts PARTITION the book: every subscriber lands in exactly one, so the
 * counts sum to the total and can be reconciled. That is deliberate. A set of
 * overlapping segments produces numbers nobody can add up, and a number nobody
 * can add up is a number nobody acts on. It is also why "expiring soon" is its
 * own cohort rather than a slice of "active" — the two are different jobs on
 * different clocks, and keeping them separate keeps the arithmetic honest.
 *
 * Assignment is a priority cascade, and the order is a business statement:
 * withdrawal beats everything (they left), a hold beats expiry (the clock is
 * paused, they have not lapsed), and only then does the calendar decide.
 */

export type CohortId =
  | "active"
  | "expiring"
  | "lapsed_7"
  | "lapsed_30"
  | "lapsed_90"
  | "lapsed_old"
  | "on_hold"
  | "withdrawn";

export interface CohortSubscriber {
  daysRemaining?: number;
  subscriptionState?: string;
  subscriptionStatus?: string;
  freezeData?: { isFrozen?: boolean };
  netAmountUSD?: number;
  remainingAmountUSD?: number;
}

/** Days ahead that counts as "about to lapse". Matches the renewal task list. */
export const EXPIRING_WINDOW_DAYS = 7;

export interface CohortDef {
  id: CohortId;
  label: string;
  /** What this group is, and what it is for. Shown under the count. */
  hint: string;
  /** Semantic tone — urgency, not decoration. */
  tone: "good" | "warn" | "urgent" | "muted";
}

export const COHORTS: CohortDef[] = [
  { id: "active",     label: "مشتركون فعّالون", hint: "اشتراك سارٍ بأكثر من أسبوع",        tone: "good"   },
  { id: "expiring",   label: "ينتهي خلال أسبوع", hint: "جدّد قبل الانتهاء — الأرخص دائماً", tone: "warn"   },
  { id: "lapsed_7",   label: "انتهى خلال أسبوع", hint: "أعلى فرصة استرجاع — اتصل الآن",     tone: "urgent" },
  { id: "lapsed_30",  label: "انتهى خلال شهر",   hint: "ما زال قريباً — يستحق مكالمة",      tone: "urgent" },
  { id: "lapsed_90",  label: "انتهى خلال ٣ شهور", hint: "يحتاج عرضاً لا تذكيراً",           tone: "warn"   },
  { id: "lapsed_old", label: "انتهى منذ أكثر من ٣ شهور", hint: "حملة جماعية لا مكالمة فردية", tone: "muted" },
  { id: "on_hold",    label: "موقوف أو متجمد",   hint: "الاشتراك معلّق — تابع موعد العودة",  tone: "muted"  },
  { id: "withdrawn",  label: "منسحبون",          hint: "غادروا — للتحليل لا للاستهداف",     tone: "muted"  },
];

function onHold(s: CohortSubscriber): boolean {
  return (
    s.subscriptionStatus === "paused" ||
    s.subscriptionStatus === "frozen" ||
    s.freezeData?.isFrozen === true
  );
}

/** The one cohort a subscriber belongs to. */
export function cohortOf(s: CohortSubscriber): CohortId {
  if (s.subscriptionState === "withdrawn") return "withdrawn";
  if (onHold(s)) return "on_hold";

  const days = s.daysRemaining ?? 0;
  if (days >= 0) return days <= EXPIRING_WINDOW_DAYS ? "expiring" : "active";

  const gone = -days;
  if (gone <= 7) return "lapsed_7";
  if (gone <= 30) return "lapsed_30";
  if (gone <= 90) return "lapsed_90";
  return "lapsed_old";
}

export interface CohortSummary extends CohortDef {
  count: number;
  /** Contract value in this group — for lapsed cohorts, what is recoverable. */
  valueUSD: number;
  /** Money still owed by this group. */
  outstandingUSD: number;
}

/**
 * Every cohort, in order, including empty ones.
 *
 * Empty cohorts are kept rather than hidden: "انتهى خلال أسبوع: 0" is a useful
 * thing to see, and a strip whose contents move around as numbers change is one
 * people stop reading.
 */
export function summarizeCohorts(subscribers: CohortSubscriber[]): CohortSummary[] {
  const acc = new Map<CohortId, { count: number; valueUSD: number; outstandingUSD: number }>(
    COHORTS.map((c) => [c.id, { count: 0, valueUSD: 0, outstandingUSD: 0 }]),
  );

  for (const s of subscribers) {
    const bucket = acc.get(cohortOf(s))!;
    bucket.count++;
    bucket.valueUSD += Number(s.netAmountUSD) || 0;
    bucket.outstandingUSD += Number(s.remainingAmountUSD) || 0;
  }

  return COHORTS.map((c) => ({ ...c, ...acc.get(c.id)! }));
}

/**
 * Newest subscription first.
 *
 * The default the owner asked for, and the right one: the newest records are
 * the ones being worked on. Sorted on `date`, the sign-up date, not the expiry.
 */
export function byNewestFirst<T extends { date?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
