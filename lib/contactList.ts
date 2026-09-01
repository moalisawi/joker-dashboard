/**
 * Turns whatever is on screen into a list you can paste into a campaign.
 *
 * This is the step that makes a cohort worth having. Filtering the book down to
 * "27 people who lapsed in the last three months" is only useful if those 27
 * can leave the screen and reach a broadcast tool without being retyped.
 *
 * Three formats because the tools genuinely differ, not to look thorough:
 * WhatsApp bulk senders usually want bare digits, international directories and
 * spreadsheets want the leading +, and a wa.me link is what you paste into a
 * doc to work through by hand.
 *
 * Two rules that matter more than the formatting:
 *
 *  • Duplicates are removed. Two subscribers can share a phone — a couple, a
 *    parent paying for a child — and sending the same person the same offer
 *    twice is how a campaign becomes a complaint.
 *  • Unusable numbers are counted and reported, never silently dropped. A list
 *    that quietly loses three people looks exactly like a list that did not.
 */

export type ContactFormat = "wa_link" | "international" | "digits";

export const CONTACT_FORMATS: { id: ContactFormat; label: string; hint: string }[] = [
  { id: "wa_link",       label: "روابط واتساب",      hint: "https://wa.me/…  للفتح واحداً واحداً" },
  { id: "digits",        label: "أرقام بلا رمز +",   hint: "970…  أكثر ما تقبله أدوات الإرسال" },
  { id: "international", label: "أرقام دولية بـ +",  hint: "+970…  للجداول والدلائل" },
];

export interface ContactRow {
  name?: string;
  dialCode?: string;
  phone?: string;
}

/**
 * Digits only, dial code first.
 *
 * Returns null rather than a broken value when there is nothing usable. Eight
 * digits is the shortest real international number; anything below that is a
 * typo or a placeholder, and putting it in a campaign list wastes a send and
 * risks reaching a stranger.
 */
export function normalizePhone(row: ContactRow): string | null {
  const digits = `${row.dialCode ?? ""}${row.phone ?? ""}`.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export interface ContactList {
  /** Ready to paste — one entry per line. */
  text: string;
  /** How many distinct numbers made it in. */
  included: number;
  /** Rows with no usable number. */
  skipped: number;
  /** Rows dropped because the number was already in the list. */
  duplicates: number;
}

export function buildContactList(rows: ContactRow[], format: ContactFormat): ContactList {
  const seen = new Set<string>();
  const out: string[] = [];
  let skipped = 0;
  let duplicates = 0;

  for (const row of rows) {
    const digits = normalizePhone(row);
    if (!digits) { skipped++; continue; }
    if (seen.has(digits)) { duplicates++; continue; }
    seen.add(digits);

    out.push(
      format === "wa_link"       ? `https://wa.me/${digits}`
      : format === "international" ? `+${digits}`
      : digits,
    );
  }

  // One per line: every tool worth using accepts it, and it survives a paste
  // into a spreadsheet column, which comma-separated text does not.
  return { text: out.join("\n"), included: out.length, skipped, duplicates };
}

/** Human summary of what just went to the clipboard, including what did not. */
export function describeContactList(list: ContactList): string {
  const parts = [`نُسخ ${list.included} رقماً`];
  if (list.duplicates > 0) parts.push(`${list.duplicates} مكرّر أُزيل`);
  if (list.skipped > 0) parts.push(`${list.skipped} بلا رقم صالح`);
  return parts.join(" · ");
}
