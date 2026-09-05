import type { Subscriber } from "@/types/subscriber";

/**
 * Who is allowed to write each field of a subscriber — one table, checked by
 * the compiler.
 *
 * The bug this exists to make impossible: the signup form collected `residence`,
 * `dialCode`, `phoneCountry`, `referrer` and `sourceDetail`, the Zod schema
 * accepted all five, and then an allow-list further down the same file dropped
 * them before the write. Nothing failed. The employee filled a box that went
 * nowhere, and a subscriber created that day came out with no country and no
 * dialling code — so no WhatsApp button, and no way to say which ad brought them.
 *
 * Two filters in series were the shape of the problem: a field had to be named
 * in the schema *and* in a separate allow-list, and the second list was written
 * once and never revisited. So the allow-list is no longer written by hand — it
 * is derived from this table, and this table is a `Record<keyof Subscriber, …>`,
 * which means **adding a field to the Subscriber type and not classifying it
 * here is a compile error**. There is no path back to a silent drop.
 *
 * The four classes:
 *
 *   client       the form owns it; the server stores what it is sent, on
 *                creation and on every later edit
 *   create_only  a fact of the contract. Written when the subscription is
 *                sold and immutable afterwards through the generic edit —
 *                only a named operation (renew, resume, freeze) may move it
 *   server       the server computes or owns it; anything a client sends is
 *                ignored (renewals, balances, timestamps, soft-delete flags)
 *   derived      never stored at all; computed on read from other fields
 *
 * `derived` is not a weaker `server`. A `server` field exists in Firestore and
 * is written by an operation; a `derived` field exists only in memory, and
 * writing one would create a second, staler copy of something already known.
 */
export type FieldPolicy = "client" | "create_only" | "server" | "derived";

/**
 * The terms of the sale. Written once, then owned by the ledger.
 *
 * `updateSubscriber` used to share its allow-list with `createSubscriber`, so
 * every one of these could be PATCHed onto the document with no matching entry
 * anywhere in the ledger — a price could be raised, an exchange rate rewritten,
 * or an expiry pushed out, and nothing downstream would record that it happened.
 *
 * Each is here because something was traced to it in the code, not because it
 * looked financial:
 *
 *   totalPrice · totalPriceUSD   the amount invoiced. `adjustPayment` guards
 *                                against paying more than this, so editing it
 *                                moves a ceiling the ledger enforces.
 *   lockedRate · currencyOriginal fixed at the moment of sale; the cycle and
 *                                every payment store the rate they used, so a
 *                                later edit would re-price history.
 *   duration · package           the service that was sold. `renewSubscription`
 *                                changes them by opening a NEW cycle.
 *   expiryDate                   written by create, renew, and the two resume
 *                                operations, each of which recomputes it from
 *                                preserved days. Never typed in after the fact.
 *   date · startDate             `revenueRecognition` spreads revenue from this
 *                                date, and the monthly cohorts bucket on it.
 *                                Moving it silently re-dates earned revenue.
 *
 * Sending one of these to `updateSubscriber` with a value that differs from
 * what is stored is rejected. Sending it unchanged is ignored, so a form that
 * echoes the whole record back can still edit a name.
 */
export const CREATE_ONLY_FIELDS = [
  "currencyOriginal",
  "lockedRate",
  "totalPrice",
  "totalPriceUSD",
  "duration",
  "package",
  "expiryDate",
  "date",
  "startDate",
] as const;

export const SUBSCRIBER_FIELD_POLICY: Record<keyof Subscriber, FieldPolicy> = {
  // ── identity ──────────────────────────────────────────────────────────────
  id:           "server",
  name:         "client",
  residence:    "client",
  phoneCountry: "client",
  dialCode:     "client",
  phone:        "client",
  phoneE164:    "client",
  age:          "client",
  gender:       "client",
  height:       "client",
  weight:       "client",
  goal:         "client",
  notes:        "client",

  // ── the subscription as sold ──────────────────────────────────────────────
  date:      "create_only",
  startDate: "create_only",
  package:   "create_only",
  duration:      "create_only",
  expiryDate:    "create_only",
  daysRemaining: "derived",
  status:        "derived",

  // ── pricing ───────────────────────────────────────────────────────────────
  currencyOriginal: "create_only",
  lockedRate:       "create_only",
  totalPrice:       "create_only",
  totalPriceUSD:    "create_only",
  // `currency` mirrors currencyOriginal and is filled on read.
  currency:           "derived",
  paidAmount:         "server",
  paidAmountUSD:      "server",
  remainingAmount:    "server",
  remainingAmountUSD: "server",
  netAmountUSD:       "server",

  // ── attribution and ownership ─────────────────────────────────────────────
  payment:         "client",
  paymentMethodId: "client",
  source:          "client",
  sourceDetail:    "client",
  referrer:        "client",
  convincedBy:    "client",
  convincedByUid: "client",
  paidShift:      "client",
  team:           "client",
  teamId:         "client",
  teamName:       "client",

  // ── lifecycle: written by their own operations, never by a form ───────────
  subscriptionState:  "server",
  subscriptionStatus: "server",
  withdrawalDate:     "server",
  withdrawalReason:   "server",
  withdrawnAt:        "server",
  withdrawalData:     "server",
  pausedAt:            "server",
  pausedBy:            "server",
  pauseReason:         "server",
  remainingDaysAtPause:"server",
  totalPausedDays:     "server",
  freezeData:          "server",

  // ── money already recorded ────────────────────────────────────────────────
  refundAmount:     "server",
  refundAmountUSD:  "server",
  refundCurrency:   "server",
  refundRate:       "server",

  // ── renewals ──────────────────────────────────────────────────────────────
  renewals:         "server",
  renewalCount:     "server",
  lifetimeValueUSD: "server",
  lastRenewalDate:  "server",
  isRenewal:        "server",
  renewalOf:        "server",
  isUpgrade:        "server",
  isDowngrade:      "server",
  originalTeam:        "server",
  originalConvincedBy: "server",
  renewedBy:           "server",

  // ── billing ledger pointers ───────────────────────────────────────────────
  currentCycleId:     "server",
  currentCycleNumber: "server",
  currentInvoiceId:   "server",
  paymentPlanType:    "server",

  // ── assignment ────────────────────────────────────────────────────────────
  assignedSalesId:          "client",
  assignedSalesName:        "client",
  assignedNutritionistId:   "client",
  assignedNutritionistName: "client",
  assignedTeamId:           "client",
  assignedTeamName:         "client",
  assignmentType:           "client",
  assignmentHistory:        "server",

  // ── workflow: set through their own endpoints, which audit the change ─────
  workflowStatus:          "server",
  workflowStatusChangedAt: "server",
  workflowStatusChangedBy: "server",
  workflowStatusNote:      "server",
  renewalWorkflowStatus:   "server",
  renewalSuggestedBy:      "server",
  renewalSuggestedByName:  "server",
  renewalHandledBy:        "server",
  renewalHandledByName:    "server",
  renewalNote:             "server",

  // Acquisition date: set once by the create operation, never by a form and
  // never by a renewal. A client that could write it could re-date a customer
  // into a month that did not earn them.
  firstSubscribedAt: "server",

  // ── meta ──────────────────────────────────────────────────────────────────
  createdAt: "server",
  createdBy: "server",
  updatedAt: "server",
  updatedBy: "server",
  deleted:   "server",
  deletedAt: "server",
  deletedBy: "server",
};

function fieldsWithPolicy(...policies: FieldPolicy[]): ReadonlySet<string> {
  return new Set<string>(
    Object.entries(SUBSCRIBER_FIELD_POLICY)
      .filter(([, policy]) => policies.includes(policy))
      .map(([field]) => field)
  );
}

/**
 * What a client may send when a subscription is being sold.
 *
 * The terms of the sale are set here and nowhere else, so `create_only` belongs
 * in this set and only in this one.
 */
export const CREATE_WRITABLE_SUBSCRIBER_FIELDS = fieldsWithPolicy("client", "create_only");

/**
 * What a generic "edit customer" may change: who the person is, not what they bought.
 *
 * The two sets differing is the entire point. One allow-list serving both paths
 * is what let an edit dialog reprice a subscription.
 */
export const UPDATE_WRITABLE_SUBSCRIBER_FIELDS = fieldsWithPolicy("client");

/** @deprecated Name kept for the create path; prefer CREATE_WRITABLE_SUBSCRIBER_FIELDS. */
export const CLIENT_WRITABLE_SUBSCRIBER_FIELDS = CREATE_WRITABLE_SUBSCRIBER_FIELDS;
