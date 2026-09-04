/**
 * Finding one subscriber from what someone typed.
 *
 * The starting point: the global search box did not search. `cmdk` was mounted
 * with `shouldFilter={false}`, which turns off its own matching, and nothing
 * replaced it — so typing anything at all, including a string matching nobody,
 * listed the same first fifty subscribers. The fifty was the second half of it:
 * the list was cut before any matching, so the fifty-first subscriber could not
 * be reached by any query.
 *
 * Everything here is pure and works on the list already in memory. That matters
 * for the fix: `useSubscribers` loads the whole permission-scoped book once and
 * keeps it live, and every screen reads that cache. So filtering locally adds no
 * query, no index and no read the app was not already doing — the cap was never
 * protecting anything, it was hiding a record.
 *
 * Two normalisations do the actual work.
 *
 * **Phone.** A number is typed in whatever form it was received in: `+970 59
 * 123 4567`, `059 1234567`, `97059…`. All three are one number, and string
 * equality says they are three. Digits are compared, not characters, and the
 * comparison is a suffix — because the difference between the local and the
 * international form is a prefix, and a suffix match is the only rule that
 * treats the trunk `0` and the country code as the same kind of noise.
 *
 * **Arabic.** `احمد` and `أحمد` are the same name to the person typing and two
 * different strings to `includes`. Alef forms, teh marbuta, alef maqsura and
 * the diacritics are folded, so what is typed finds what was stored regardless
 * of which keyboard entered it.
 */

/** Below this, digits are ambiguous enough to match most of the book. */
const MIN_PHONE_DIGITS = 3;

/** Arabic diacritics (tashkeel) and the tatweel elongation mark. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/**
 * Fold a name to a comparable form.
 *
 * Latin text is lower-cased; Arabic loses its diacritics and its
 * interchangeable letter forms. Both then lose their extra whitespace, so a
 * double space between two words never hides a match.
 */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits only — drops `+`, spaces, hyphens, parentheses and Arabic-Indic forms. */
export function toDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660)
  ).replace(/\D/g, "");
}

/**
 * The forms of a subscriber's number worth comparing against.
 *
 * Both the full international string and the bare national number, because a
 * query can legitimately be either, and neither contains the other once a trunk
 * `0` is involved.
 */
export function phoneCandidates(row: {
  dialCode?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
}): string[] {
  const national = toDigits(row.phone);
  const dial = toDigits(row.dialCode);
  const e164 = toDigits(row.phoneE164);

  const forms = new Set<string>();
  if (national) {
    forms.add(national);
    // A stored national number may itself carry the trunk zero.
    forms.add(national.replace(/^0+/, ""));
    if (dial) forms.add(dial + national.replace(/^0+/, ""));
  }
  if (e164) forms.add(e164);
  return [...forms].filter(Boolean);
}

/**
 * Does this typed number refer to this subscriber?
 *
 * Suffix, not equality: `059 123 4567` and `+970 59 123 4567` share their tail
 * and differ only in how the front is written. The query's leading zeros go
 * first for the same reason — `0` is a trunk prefix, not part of the number.
 */
export function phoneMatches(
  row: { dialCode?: string | null; phone?: string | null; phoneE164?: string | null },
  queryDigits: string
): boolean {
  if (queryDigits.length < MIN_PHONE_DIGITS) return false;
  const trimmed = queryDigits.replace(/^0+/, "") || queryDigits;
  return phoneCandidates(row).some(
    (candidate) =>
      candidate.endsWith(trimmed) ||
      candidate.includes(trimmed) ||
      candidate.includes(queryDigits)
  );
}

export interface SearchableCustomer {
  name?: string | null;
  phone?: string | null;
  dialCode?: string | null;
  phoneE164?: string | null;
  residence?: string | null;
  package?: string | null;
  team?: string | null;
  convincedBy?: string | null;
}

/**
 * One subscriber against one query.
 *
 * A query containing digits is tried as a phone *as well as* text, never
 * instead of it — a name is not excluded because someone typed a `3` in it, and
 * a number is still found when it was saved into the wrong field.
 */
export function matchesCustomer(row: SearchableCustomer, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const digits = toDigits(query);
  if (digits.length >= MIN_PHONE_DIGITS && phoneMatches(row, digits)) return true;

  const needle = normalizeName(query);
  if (!needle) return false;

  const haystack = normalizeName(
    [row.name, row.residence, row.package, row.team, row.convincedBy]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
}

/**
 * Filter a book by a query.
 *
 * Returns every match. The caller decides how many to draw — which is the whole
 * correction: the cap belongs to rendering, after the matching, never before it.
 */
export function searchCustomers<T extends SearchableCustomer>(
  rows: T[],
  rawQuery: string
): T[] {
  const query = rawQuery.trim();
  if (!query) return rows;
  return rows.filter((row) => matchesCustomer(row, query));
}
