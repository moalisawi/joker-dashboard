/**
 * One shape for user-lifecycle audit entries.
 *
 * Every route under /api/employees was assembling the same twenty-field
 * auditLogs document by hand, and they had already drifted: some set
 * `entityName`, some did not; `createdAt` was an ISO string in one place and a
 * server timestamp in another, so the log sorted wrongly whenever the two mixed.
 * The log is the only record of who disabled or archived whom, so it is worth
 * having exactly one writer.
 *
 * Never throws. A failed audit write must not fail the operation it describes —
 * the caller has already changed the account by the time this runs.
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/constants/collections";
import type { VerifiedServerUser } from "@/lib/serverAuth";

export type AuditSeverityLevel = "info" | "warning" | "critical";

export interface UserAuditEntry {
  action: string;
  targetUid: string;
  targetName?: string | null;
  description: string;
  severity?: AuditSeverityLevel;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/** `undefined` is not a Firestore value; nulls keep the field present and legible. */
function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v]));
}

export async function writeUserAudit(
  actor: VerifiedServerUser,
  entry: UserAuditEntry
): Promise<void> {
  const performer = {
    uid:   actor.uid,
    name:  actor.email ?? actor.uid,
    email: actor.email ?? "",
    role:  actor.role,
  };

  try {
    await getFirestore().collection(COLLECTIONS.AUDIT_LOGS).add({
      action:      entry.action,
      category:    "user",
      severity:    entry.severity ?? "info",
      source:      "server",
      entityType:  "user",
      entityId:    entry.targetUid,
      entityName:  entry.targetName ?? null,
      description: entry.description,
      performedBy: performer,
      metadata:    sanitize(entry.metadata ?? {}),
      tags:        entry.tags ?? ["user"],
      status:      "completed",
      actorUid:    performer.uid,
      actorName:   performer.name,
      actorRole:   performer.role,
      targetType:  "user",
      targetId:    entry.targetUid,
      targetName:  entry.targetName ?? null,
      summary:     entry.description,
      createdAt:   FieldValue.serverTimestamp(),
    });
  } catch {
    /* non-fatal by contract — see the module note */
  }
}
