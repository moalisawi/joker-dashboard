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
 *   client         the form owns it; the server stores what it is sent
 *   client_review  the client can write it today and probably should not —
 *                  see the note below; behaviour is identical to `client`
 *   server         the server computes or owns it; anything a client sends is
 *                  ignored (renewals, balances, timestamps, soft-delete flags)
 *   derived        never stored at all; computed on read from other fields
 *
 * `derived` is not a weaker `server`. A `server` field exists in Firestore and
 * is written by an operation; a `derived` field exists only in memory, and
 * writing one would create a second, staler copy of something already known.
 */
export type FieldPolicy = "client" | "client_review" | "server" | "derived";

/**
 * Fields a client can write today that arguably belong to the ledger.
 *
 * `updateSubscriber` shares its allow-list with `createSubscriber`, so a price
 * or an exchange rate can be PATCHed straight onto the document without a
 * matching ledger entry. Narrowing that is a real change to who owns the money
 * — it would stop the edit dialog from repricing a subscription — and it is not
 * a Phase 0 change. It is recorded here, and the test asserts this list does not
 * grow, so nothing new joins it unnoticed.
 */
export const CLIENT_REVIEW_FIELDS = [
  "currencyOriginal",
  "lockedRate",
  "totalPrice",
  "totalPriceUSD",
  "duration",
  "expiryDate",
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
  date:      "client",
  startDate: "client",
  package:   "client",
  duration:      "client_review",
  expiryDate:    "client_review",
  daysRemaining: "derived",
  status:        "derived",

  // ── pricing ───────────────────────────────────────────────────────────────
  currencyOriginal: "client_review",
  lockedRate:       "client_review",
  totalPrice:       "client_review",
  totalPriceUSD:    "client_review",
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

  // ── meta ──────────────────────────────────────────────────────────────────
  createdAt: "server",
  createdBy: "server",
  updatedAt: "server",
  updatedBy: "server",
  deleted:   "server",
  deletedAt: "server",
  deletedBy: "server",
};

/**
 * The fields a client may write — derived, never hand-maintained.
 *
 * `client_review` is included because it describes what the system does today.
 * Reclassifying those six is a deliberate change for a later phase, not a
 * side-effect of writing this table down.
 */
export const CLIENT_WRITABLE_SUBSCRIBER_FIELDS: ReadonlySet<string> = new Set<string>(
  Object.entries(SUBSCRIBER_FIELD_POLICY)
    .filter(([, policy]) => policy === "client" || policy === "client_review")
    .map(([field]) => field)
);
