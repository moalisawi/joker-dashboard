/**
 * What is attached to a user account.
 *
 * Disabling or archiving someone is not a decision about one document: their uid
 * is stamped on subscribers, on WhatsApp leads, and possibly on a team they
 * lead. Before this module the delete confirmation said only "البيانات التاريخية
 * ستبقى" — true, but it never said how much data that was, so the person
 * clicking had no way to know whether they were about to orphan three records or
 * three hundred.
 *
 * The four transferable scopes below are the fields that actually exist on the
 * documents (verified against types/subscriber.ts and types/whatsapp-lead.ts).
 * Payments and refunds are deliberately absent: they are a record of what
 * happened, and rewriting who earned them would falsify history. They are reported in
 * the summary as context and never moved.
 *
 * Server-only — every function here uses the Admin SDK.
 */

import { getFirestore, FieldValue, type Query } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { SCOPE_META, TRANSFER_SCOPES, type TransferScope } from "@/constants/transferScopes";

export { TRANSFER_SCOPES, SCOPE_META };
export type { TransferScope };

// ─── Types ────────────────────────────────────────────────────────────────────

import type { UserImpact } from "@/lib/userImpact.types";
export type { UserImpact };

// ─── Counting ─────────────────────────────────────────────────────────────────

async function countQuery(q: Query): Promise<number | null> {
  try {
    const snap = await q.count().get();
    return snap.data().count;
  } catch {
    // A missing composite index or a transient failure must not make the
    // confirmation dialog refuse to open. The caller marks the summary partial
    // and the UI says so rather than showing a confident zero.
    return null;
  }
}

/**
 * How many session documents to pull when counting live sessions. Far above any
 * real account's history; see the note in buildImpactSummary for why this is a
 * scan rather than an aggregation.
 */
const SESSION_SCAN_LIMIT = 300;

/** Documents in `scope` currently pointing at `uid`. */
export function scopeQuery(scope: TransferScope, uid: string): Query {
  const meta = SCOPE_META[scope];
  return getFirestore().collection(meta.collection).where(meta.field, "==", uid);
}

export async function buildImpactSummary(uid: string): Promise<UserImpact> {
  const db = getFirestore();
  let partial = false;

  const counts = await Promise.all(
    TRANSFER_SCOPES.map(async (scope) => {
      const n = await countQuery(scopeQuery(scope, uid));
      if (n === null) partial = true;
      return { scope, label: SCOPE_META[scope].label, count: n ?? 0 };
    })
  );

  const [ledTeamsSnap, sessionsSnap, payments, auditEntries] = await Promise.all([
    db.collection(COLLECTIONS.TEAMS).where("leaderId", "==", uid).get().catch(() => null),
    // One equality filter, then filtered in memory.
    //
    // The obvious query is `.where("uid", ...).where("status", "==", "active")`
    // with a count() aggregation, but two equality filters plus an aggregation
    // is the shape most likely to demand a composite index that this repo has
    // not declared — and a query whose index is missing throws, which would
    // flip the whole summary to `partial` and print "تعذّر حساب البيانات
    // المرتبطة" on a dialog that is otherwise perfectly correct. A single-field
    // query always resolves from the automatic index. Nobody has enough
    // sessions for the cap to matter, and it is stated rather than silent.
    db.collection(COLLECTIONS.LOGIN_SESSIONS)
      .where("uid", "==", uid)
      .limit(SESSION_SCAN_LIMIT)
      .get()
      .catch(() => null),
    countQuery(db.collection(COLLECTIONS.PAYMENTS).where("convincedByUid", "==", uid)),
    countQuery(db.collection(COLLECTIONS.AUDIT_LOGS).where("actorUid", "==", uid)),
  ]);

  if (ledTeamsSnap === null || sessionsSnap === null || payments === null || auditEntries === null) {
    partial = true;
  }

  const activeSessions = (sessionsSnap?.docs ?? [])
    .filter((d) => d.data().status === "active" || d.data().isActive === true)
    .length;

  return {
    uid,
    scopes: counts,
    transferableTotal: counts.reduce((sum, c) => sum + c.count, 0),
    ledTeams: (ledTeamsSnap?.docs ?? []).map((d) => ({
      id:   d.id,
      name: (d.data().name as string | undefined) ?? d.id,
    })),
    activeSessions,
    historical: { payments: payments ?? 0, auditEntries: auditEntries ?? 0 },
    partial,
  };
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

/** Firestore caps a batch at 500 writes; each document here costs exactly one. */
const BATCH_LIMIT = 450;

/**
 * Repoint one scope from `fromUid` to `toUid`.
 *
 * Batched rather than transactional on purpose: a transaction is capped well
 * below the number of subscribers a long-serving salesperson accumulates, and
 * the operation is idempotent — re-running it after a partial failure moves only
 * what is left, because the query itself is "still pointing at the old owner".
 * Returns how many documents moved.
 */
export async function transferScope(
  scope: TransferScope,
  fromUid: string,
  toUid: string,
  actorUid: string
): Promise<number> {
  const db    = getFirestore();
  const meta  = SCOPE_META[scope];
  let moved   = 0;

  for (;;) {
    const snap = await scopeQuery(scope, fromUid).limit(BATCH_LIMIT).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        [meta.field]:        toUid,
        transferredFromUid:  fromUid,
        transferredAt:       FieldValue.serverTimestamp(),
        transferredBy:       actorUid,
        updatedAt:           FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    moved += snap.size;

    if (snap.size < BATCH_LIMIT) break;
  }

  return moved;
}
