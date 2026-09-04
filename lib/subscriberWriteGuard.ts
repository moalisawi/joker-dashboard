import { CREATE_ONLY_FIELDS } from "@/constants/subscriberFieldPolicy";

/**
 * Who may change what, enforced on the server write path.
 *
 * Selling a subscription and editing a customer were the same write. One
 * allow-list served `createSubscriber` and `updateSubscriber` alike, so a
 * generic "edit customer" dialog could raise a price, rewrite an exchange rate,
 * change the package, or push an expiry date out — on a record that had already
 * been invoiced, with no entry anywhere in the ledger saying it happened. The
 * UI never offered most of it, which only meant the door was unlocked rather
 * than advertised: a direct POST carrying `{ totalPrice: 999999 }` was accepted.
 *
 * Nothing here hides fields. Hiding is not enforcement — the check runs after
 * authentication and before the write, so it holds whatever the caller is.
 *
 * Free of Firestore so the rules can be tested as pure functions, which is the
 * only way the refusal is provable without standing up an emulator.
 */

/**
 * Tolerance when comparing money.
 *
 * Half a cent. A price that has made a round trip through a text input and back
 * can return as 49.999999999999996 with nobody having touched it, and refusing
 * that as "an attempt to reprice" would block every ordinary save.
 */
export const MONEY_EPSILON = 0.005;

/**
 * Did the caller send something *different* from what is stored?
 *
 * Unchanged echoes are not violations. The edit dialog sends the whole record
 * on every save, so refusing on presence would mean no one could fix a spelling
 * without the request failing — and a rule that blocks ordinary work is a rule
 * that gets deleted. What must never pass is a changed value.
 *
 * `undefined` and `null` mean "not sent" rather than "set to empty": a partial
 * update that omits the price is not an attempt to clear it.
 */
export function differsFromStored(sent: unknown, stored: unknown): boolean {
  if (sent === undefined || sent === null) return false;

  const sentNum = typeof sent === "number" ? sent : Number(sent);
  const storedNum = typeof stored === "number" ? stored : Number(stored);
  const bothNumeric =
    sent !== "" &&
    stored !== "" &&
    stored !== undefined &&
    stored !== null &&
    Number.isFinite(sentNum) &&
    Number.isFinite(storedNum);
  if (bothNumeric) return Math.abs(sentNum - storedNum) > MONEY_EPSILON;

  if (stored === undefined || stored === null) return String(sent) !== "";
  return String(sent) !== String(stored);
}

/**
 * The terms of the sale this request is trying to move, in policy order.
 *
 * Empty means the request touches nothing it may not touch — not that it is
 * harmless, only that it is not a repricing.
 */
export function findImmutableViolations(
  sent: Record<string, unknown>,
  stored: Record<string, unknown>
): string[] {
  return CREATE_ONLY_FIELDS.filter((field) => differsFromStored(sent[field], stored[field]));
}

/** Arabic names, so a refusal says which field was refused and why. */
const IMMUTABLE_FIELD_LABELS: Record<string, string> = {
  totalPrice:       "السعر",
  totalPriceUSD:    "السعر بالدولار",
  lockedRate:       "سعر الصرف",
  currencyOriginal: "العملة",
  duration:         "مدة الاشتراك",
  package:          "الباقة",
  expiryDate:       "تاريخ الانتهاء",
  date:             "تاريخ الاشتراك",
  startDate:        "تاريخ البدء",
};

/**
 * A refusal that names the field and the way that *is* open.
 *
 * "Forbidden" on its own teaches nobody what to do instead, and the next
 * attempt is a workaround.
 */
export function immutableRefusalMessage(fields: readonly string[]): string {
  const names = fields.map((f) => IMMUTABLE_FIELD_LABELS[f] ?? f).join("، ");
  return (
    `لا يمكن تعديل ${names} من نافذة تعديل المشترك — ` +
    `هذه شروط بيع مثبّتة في الفاتورة والدورة. ` +
    `التجديد يفتح دورة جديدة، والتجميد والاستئناف يحرّكان تاريخ الانتهاء وحدهما.`
  );
}

/** Keep only the keys an allow-list names. */
export function pickWritable(
  raw: Record<string, unknown>,
  allowed: ReadonlySet<string>
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([k]) => allowed.has(k)));
}
