/**
 * Firestore Migration: joker-52b38 → joker-prod
 *
 * Before running:
 *   1. Download service account key for joker-52b38:
 *      Firebase Console → joker-52b38 → Project Settings → Service accounts
 *      → Generate new private key → save as "sa-old.json" in this folder
 *
 *   2. Download service account key for joker-prod:
 *      Firebase Console → joker-prod → Project Settings → Service accounts
 *      → Generate new private key → save as "sa-new.json" in this folder
 *
 *   3. Run:
 *      node migrate.js
 *
 * monthlyAnalytics is intentionally skipped — the Cloud Function will
 * recompute it. Call recomputeMonthlyAnalytics({ month: "YYYY-MM" }) from
 * the Firebase Console or your admin UI for each past month you need.
 */

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────

const COLLECTIONS = [
  "users",
  "subscribers",
  "payments",
  "refunds",
  "auditLogs",
  "notifications",
  "exchangeRates",
  // "monthlyAnalytics" — skipped, recomputed by Cloud Function
];

const BATCH_SIZE = 400; // safely below Firestore's 500-op limit

// ─── Init two apps ────────────────────────────────────────────────────────────

const saOldPath = path.join(__dirname, "sa-old.json");
const saNewPath = path.join(__dirname, "sa-new.json");

for (const p of [saOldPath, saNewPath]) {
  if (!fs.existsSync(p)) {
    console.error(`\n❌ Missing file: ${path.basename(p)}`);
    console.error("   See the instructions at the top of this file.\n");
    process.exit(1);
  }
}

const saOld = require(saOldPath);
const saNew = require(saNewPath);

const srcApp = admin.initializeApp(
  { credential: admin.credential.cert(saOld), projectId: "joker-52b38" },
  "source"
);
const dstApp = admin.initializeApp(
  { credential: admin.credential.cert(saNew), projectId: "joker-prod" },
  "destination"
);

const src = srcApp.firestore();
const dst = dstApp.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function migrateCollection(name) {
  process.stdout.write(`\n📦 ${name} … `);

  const snap = await src.collection(name).get();
  if (snap.empty) {
    console.log("empty, skipped.");
    return;
  }

  const docs  = snap.docs;
  let written = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = dst.batch();

    for (const doc of chunk) {
      batch.set(dst.collection(name).doc(doc.id), doc.data());
    }

    await batch.commit();
    written += chunk.length;
    process.stdout.write(`${written}/${docs.length} `);
  }

  console.log("✅");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Migration: joker-52b38 → joker-prod");
  console.log("   Collections:", COLLECTIONS.join(", "));
  console.log("   monthlyAnalytics: skipped (recomputed by Cloud Function)\n");

  const start = Date.now();

  for (const name of COLLECTIONS) {
    await migrateCollection(name);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log("\nNext step: recompute monthlyAnalytics for each past month via:");
  console.log('  recomputeMonthlyAnalytics({ month: "YYYY-MM" })\n');

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
