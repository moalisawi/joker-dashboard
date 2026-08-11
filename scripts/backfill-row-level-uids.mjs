/**
 * Backfills `convincedByUid` onto refunds and subscriberNotes.
 *
 * The tightened rules in firestore.rules scope employee reads of these two
 * collections to the uid that owns the subscriber. Documents written before the
 * field existed carry no uid, so they fail the rule and become staff-only —
 * the safe direction to fail, but it hides an employee's own history from them.
 *
 * Run this BEFORE deploying the rules. Publishing first is the mistake
 * docs/SECURITY-HARDENING-2026-08.md documents: employees lose sight of records
 * that are legitimately theirs, and it looks like data loss.
 *
 * The uid is resolved from the parent subscriber, which is the authority.
 * Documents whose subscriber is gone, or whose subscriber itself has no uid,
 * are reported and left alone rather than guessed at.
 *
 *   node scripts/backfill-row-level-uids.mjs             # dry run
 *   node scripts/backfill-row-level-uids.mjs --apply
 *
 * Idempotent: a document that already carries a uid is skipped.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, "base64").toString("utf8"),
  }),
});

const db = getFirestore();

// subscriberId -> convincedByUid, read once rather than per document.
const owners = new Map();
for (const doc of (await db.collection("subscribers").get()).docs) {
  const uid = doc.data().convincedByUid;
  if (typeof uid === "string" && uid.trim()) owners.set(doc.id, uid.trim());
}
console.log(`subscribers with a convincedByUid: ${owners.size}`);

async function backfill(collectionName) {
  const snap = await db.collection(collectionName).get();
  let already = 0;
  let orphaned = 0;
  let ownerless = 0;
  const updates = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.convincedByUid === "string" && data.convincedByUid.trim()) {
      already++;
      continue;
    }
    const subscriberId = data.subscriberId;
    if (!subscriberId) {
      orphaned++;
      continue;
    }
    const uid = owners.get(subscriberId);
    if (!uid) {
      // Either the subscriber was deleted, or it never had an owner recorded.
      ownerless++;
      continue;
    }
    updates.push({ ref: doc.ref, uid });
  }

  console.log(
    `\n${collectionName}: ${snap.size} documents` +
      `\n  already tagged      : ${already}` +
      `\n  to backfill         : ${updates.length}` +
      `\n  no subscriberId     : ${orphaned}` +
      `\n  subscriber gone/unowned : ${ownerless}  (stay staff-only)`
  );

  if (!APPLY || updates.length === 0) return;

  // Chunked to stay inside the 500-write batch limit.
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    for (const { ref, uid } of updates.slice(i, i + 400)) {
      batch.update(ref, { convincedByUid: uid });
    }
    await batch.commit();
  }
  console.log(`  -> updated ${updates.length}`);
}

await backfill("refunds");
await backfill("subscriberNotes");

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply, then deploy the rules.");
} else {
  console.log("\nBackfill complete. Now deploy: firebase deploy --only firestore:rules");
}
