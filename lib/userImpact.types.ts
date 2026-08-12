/**
 * The impact-summary shape, without the Admin SDK.
 *
 * lib/userImpact.ts imports firebase-admin, so a component that only needs to
 * render these numbers cannot import the type from there — the bundler would
 * follow it into server-only code. The type lives here and both sides import it.
 */

import type { TransferScope } from "@/constants/transferScopes";

export interface UserImpact {
  uid: string;
  /** Per-scope counts, in the order of TRANSFER_SCOPES. */
  scopes: { scope: TransferScope; label: string; count: number }[];
  /** Sum of the transferable scopes — the number that decides whether to prompt. */
  transferableTotal: number;
  /** Teams this user leads. Reassigning the leader is a separate, manual step. */
  ledTeams: { id: string; name: string }[];
  /** Live login sessions. Disabling revokes them; this says how many break. */
  activeSessions: number;
  /** Historical records that stay bound to this uid whatever happens. */
  historical: { payments: number; auditEntries: number };
  /** True when a count could not be taken (missing index, permission, outage). */
  partial: boolean;
}
