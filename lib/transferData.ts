/**
 * Handing one person's assigned work to another.
 *
 * Shared by /api/employees/transfer-data and by the deactivate and archive
 * routes, which both offer to run it first. Keeping it here rather than in a
 * route means the hand-over is the same operation — and writes the same audit
 * entry — whether it was asked for on its own or as a step inside archiving
 * someone.
 */

import { transferScope, type TransferScope } from "@/lib/userImpact";
import { SCOPE_META } from "@/constants/transferScopes";
import { writeUserAudit } from "@/lib/serverAudit";
import type { VerifiedServerUser } from "@/lib/serverAuth";

export interface TransferResult {
  scope: TransferScope;
  label: string;
  moved: number;
}

/**
 * Move every selected scope from `fromUid` to `toUid` and log the counts.
 *
 * Scopes run in sequence rather than in parallel: they can touch the same
 * subscriber document (a person can be both the convincer and the assigned
 * salesperson), and two concurrent batch writes to one document is a contention
 * failure, not a speed-up.
 *
 * The audit entry records the per-scope counts, which is the only durable answer
 * to "where did these two hundred subscribers go?" months later.
 */
export async function runTransfer(
  actor: VerifiedServerUser,
  params: {
    fromUid: string;
    fromName?: string;
    toUid: string;
    toName?: string;
    scopes: TransferScope[];
    reason?: string;
    /** Distinguishes a standalone transfer from one performed while archiving. */
    context?: string;
  }
): Promise<TransferResult[]> {
  const results: TransferResult[] = [];

  for (const scope of params.scopes) {
    const moved = await transferScope(scope, params.fromUid, params.toUid, actor.uid);
    results.push({ scope, label: SCOPE_META[scope].label, moved });
  }

  const total = results.reduce((sum, r) => sum + r.moved, 0);

  await writeUserAudit(actor, {
    action:      "user_data_transferred",
    severity:    "warning",
    targetUid:   params.fromUid,
    targetName:  params.fromName ?? params.fromUid,
    description: `نقل ${total} سجلاً من ${params.fromName ?? params.fromUid} إلى ${params.toName ?? params.toUid}`,
    metadata: {
      fromUid: params.fromUid,
      toUid:   params.toUid,
      toName:  params.toName ?? null,
      reason:  params.reason ?? null,
      context: params.context ?? "standalone",
      total,
      counts:  Object.fromEntries(results.map((r) => [r.scope, r.moved])),
    },
    tags: ["user", "transfer"],
  });

  return results;
}
