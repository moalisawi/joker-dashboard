import { isActiveNow, isInCustomerBase } from "@/lib/subscriberLifecycle";

/**
 * Turns the subscriber book into a day's work.
 *
 * The dashboard already showed plenty of numbers and no next action. An
 * employee opening it in the morning could see that 31 subscriptions had
 * expired and that $207 was outstanding, but not who to call first — the
 * numbers were true and useless in the same breath. Everything below is derived
 * from data the app already had; nothing new is stored.
 *
 * Three questions, in the order a working day actually asks them:
 *
 *   1. Who is about to leave?   — renewals, the cheapest revenue there is
 *   2. Who just left?           — recently expired, still winnable
 *   3. Who owes money?          — collection
 *
 * Deliberately NOT a fourth bucket for long-expired subscribers. 31 of this
 * book expired, most of them months ago; a list that long is not a task list,
 * it is a graveyard, and putting it on the morning screen would train people to
 * ignore the screen. Those belong in a campaign, not in today.
 */

export interface TaskSubscriber {
  id: string;
  name: string;
  phone?: string;
  dialCode?: string;
  daysRemaining?: number;
  remainingAmountUSD?: number;
  package?: string;
  subscriptionState?: string;
  subscriptionStatus?: string;
  freezeData?: { isFrozen?: boolean };
  assignedSalesName?: string | null;
  convincedBy?: string;
  /** Outcome of the last follow-up, written by /api/subscribers/renewal-status. */
  renewalWorkflowStatus?: string;
}

export interface TaskItem {
  subscriber: TaskSubscriber;
  /** Sorting weight — smaller is more urgent. */
  urgency: number;
  /** Short reason shown on the row, e.g. "ينتهي غداً". */
  reason: string;
  /** Someone has already spoken to them and the outcome is still open. */
  inProgress: boolean;
  /**
   * The outstanding balance, when this row is a collection.
   *
   * Kept as a number rather than baked into `reason` so the UI can isolate it
   * for bidirectional text. "$165" inside an Arabic sentence renders as "165$"
   * — the currency sign is a neutral character and drifts to the wrong side of
   * the digits — which looks like a typo in a screen about money.
   */
  amountUSD?: number;
}

/**
 * Outcomes that end the work. A renewed or declined subscriber leaves the list;
 * anything else is still owed a call.
 *
 * "contacted" and "promised" deliberately do NOT remove the row. A promise is
 * not a payment, and a list that hides everyone who answered the phone is a
 * list that loses them. They sink to the bottom instead, dimmed — visible
 * progress rather than vanished work.
 *
 * There is no "handled today" here on purpose: the record carries no
 * renewalHandledAt, and updatedAt is overwritten by any edit at all, so a
 * same-day filter would be a guess dressed as a fact.
 */
const SETTLED = new Set(["renewed", "declined"]);
const IN_PROGRESS = new Set(["contacted", "promised"]);

export interface TodayTasks {
  renewals: TaskItem[];
  winBack: TaskItem[];
  collections: TaskItem[];
  /** Everything that needs doing, for the header count. */
  total: number;
}

/** How far ahead a renewal is worth chasing. */
export const RENEWAL_HORIZON_DAYS = 7;
/** How far back an expiry is still worth a win-back call. */
export const WIN_BACK_WINDOW_DAYS = 30;

function renewalReason(days: number): string {
  if (days <= 0) return "ينتهي اليوم";
  if (days === 1) return "ينتهي غداً";
  return `ينتهي خلال ${days} أيام`;
}

function winBackReason(daysPast: number): string {
  if (daysPast <= 1) return "انتهى أمس";
  if (daysPast <= 7) return `انتهى منذ ${daysPast} أيام`;
  return `انتهى منذ ${daysPast} يوماً`;
}

export function buildTodayTasks(subscribers: TaskSubscriber[]): TodayTasks {
  const renewals: TaskItem[] = [];
  const winBack: TaskItem[] = [];
  const collections: TaskItem[] = [];

  for (const s of subscribers) {
    // Withdrawn subscribers are nobody's task. Paused and frozen ones are
    // excluded from renewals by isActiveNow, but they can still owe money, so
    // collections uses the wider isInCustomerBase.
    const days = s.daysRemaining ?? 0;

    const status = s.renewalWorkflowStatus ?? "";
    const settled = SETTLED.has(status);
    const inProgress = IN_PROGRESS.has(status);
    // Rows already spoken to keep their place among themselves but sit below
    // everyone still untouched, so the top of the list is always fresh work.
    const rank = (base: number) => (inProgress ? base + 100000 : base);

    if (!settled && isActiveNow(s) && days <= RENEWAL_HORIZON_DAYS) {
      renewals.push({ subscriber: s, urgency: rank(days), reason: renewalReason(days), inProgress });
    }

    if (!settled && isInCustomerBase(s) && days < 0 && -days <= WIN_BACK_WINDOW_DAYS) {
      winBack.push({ subscriber: s, urgency: rank(-days), reason: winBackReason(-days), inProgress });
    }

    const owed = Number(s.remainingAmountUSD) || 0;
    if (isInCustomerBase(s) && owed > 0) {
      // Largest balance first: chasing $200 before $3 is simply worth more, and
      // an employee working top-down should not have to sort by eye.
      // Not filtered by SETTLED: a renewal outcome says nothing about whether
      // the old balance was paid.
      collections.push({
        subscriber: s,
        amountUSD: owed,
        urgency: -owed,
        reason: `متبقٍّ $${owed.toFixed(owed % 1 === 0 ? 0 : 2)}`,
        inProgress: false,
      });
    }
  }

  const byUrgency = (a: TaskItem, b: TaskItem) => a.urgency - b.urgency;
  renewals.sort(byUrgency);
  winBack.sort(byUrgency);
  collections.sort(byUrgency);

  return {
    renewals,
    winBack,
    collections,
    total: renewals.length + winBack.length + collections.length,
  };
}

/** International dialling form for a WhatsApp deep link, or null if unusable. */
export function whatsappNumber(s: TaskSubscriber): string | null {
  const raw = `${s.dialCode ?? ""}${s.phone ?? ""}`.replace(/[^\d]/g, "");
  return raw.length >= 8 ? raw : null;
}
