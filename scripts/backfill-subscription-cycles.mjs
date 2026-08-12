/**
 * Reconstructs `subscriptionCycles` + `invoices` for subscribers that predate
 * the billing ledger.
 *
 * **This backfill is optional and the application does not need it.**
 * `legacyToCurrentCycleView()` renders a subscriber with no `currentCycleId`
 * straight from the summary fields on the subscriber document, and the billing
 * tab says so on screen. Running this only turns those reconstructions into
 * real, queryable documents so historical subscribers appear in invoice-level
 * reporting alongside new ones.
 *
 * What it can and cannot recover:
 *
 *  • The CURRENT cycle is reconstructable — every figure it needs
 *    (package, dates, totalPriceUSD, paidAmountUSD, refundAmountUSD) is on the
 *    subscriber document.
 *  • PAST cycles are reconstructed from the `renewalHistory` sub-collection
 *    where one exists. Subscribers renewed under the older embedded
 *    `renewals[]` array are reported and skipped: that array does not carry a
 *    per-cycle exchange rate, so any invoice built from it would be guesswork
 *    priced in the wrong currency.
 *  • INSTALMENTS are never invented. Nothing in the old data records a payment
 *    schedule, so a reconstructed invoice is always `paymentPlanType: "full"`.
 *    Fabricating due dates would produce overdue instalments that nobody ever
 *    agreed to and an AR aging report built on fiction.
 *
 * Invoice numbers are drawn from the same `counters/invoices-<year>` documents
 * the live route uses, so a backfill cannot collide with an invoice issued
 * while it runs.
 *
 *   node scripts/backfill-subscription-cycles.mjs             # dry run (default)
 *   node scripts/backfill-subscription-cycles.mjs --apply
 *
 * Idempotent: a subscriber that already has `currentCycleId` is skipped.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const pad6 = (n) => String(n).padStart(6, "0");

/** Mirrors deriveBillingStatus() in lib/subscriberLifecycle.ts. */
function invoiceStatus({ totalUSD, paidUSD, refundedUSD, dueDate, today }) {
  if (refundedUSD > 0 && refundedUSD >= paidUSD - 0.01 && paidUSD > 0) return "refunded";
  if (totalUSD <= 0) return "paid";
  if (paidUSD >= totalUSD - 0.01) return "paid";
  if (dueDate && dueDate < today) return "overdue";
  return paidUSD > 0 ? "partially_paid" : "issued";
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  const snap = await db.collection("subscribers").get();

  const stats = {
    scanned: 0,
    skippedDeleted: 0,
    skippedHasCycle: 0,
    cyclesToCreate: 0,
    invoicesToCreate: 0,
    historyCyclesToCreate: 0,
    legacyArrayRenewalsSkipped: 0,
    zeroPriceNoInvoice: 0,
  };
  const samples = [];

  // Reserve numbers locally so a dry run reports realistic ones without writing.
  const counterRef = db.collection("counters").doc(`invoices-${year}`);
  let sequence = num((await counterRef.get()).data()?.sequence);

  for (const doc of snap.docs) {
    stats.scanned++;
    const s = doc.data() ?? {};

    if (s.deleted === true) { stats.skippedDeleted++; continue; }
    if (str(s.currentCycleId)) { stats.skippedHasCycle++; continue; }

    const paid     = num(s.paidAmountUSD);
    const total    = num(s.totalPriceUSD);
    const refunded = num(s.refundAmountUSD);
    const rate     = num(s.lockedRate, 1) || 1;
    const startDate = str(s.startDate, str(s.date, today));
    const expiryDate = str(s.expiryDate, startDate);
    const convincedByUid = str(s.convincedByUid) || null;

    // Past cycles, where a renewalHistory sub-collection exists.
    const history = await doc.ref.collection("renewalHistory").get();
    const embeddedRenewals = Array.isArray(s.renewals) ? s.renewals.length : 0;
    if (history.empty && embeddedRenewals > 0) {
      stats.legacyArrayRenewalsSkipped += embeddedRenewals;
    }
    stats.historyCyclesToCreate += history.size;

    const currentCycleNumber = num(s.renewalCount) + 1;
    stats.cyclesToCreate++;

    const willInvoice = total > 0;
    if (!willInvoice) stats.zeroPriceNoInvoice++;

    let invoiceNumber = null;
    if (willInvoice) {
      sequence++;
      invoiceNumber = `INV-${year}-${pad6(sequence)}`;
      stats.invoicesToCreate++;
    }

    const status = invoiceStatus({ totalUSD: total, paidUSD: paid, refundedUSD: refunded, dueDate: expiryDate, today });

    if (samples.length < 8) {
      samples.push({
        subscriber: str(s.name, doc.id),
        cycleNumber: currentCycleNumber,
        pastCycles: history.size,
        totalUSD: total.toFixed(2),
        paidUSD: paid.toFixed(2),
        invoiceNumber,
        status,
      });
    }

    if (!APPLY) continue;

    // ── Writes (only with --apply) ──
    const batch = db.batch();

    history.forEach((h) => {
      const hd = h.data() ?? {};
      const ref = db.collection("subscriptionCycles").doc();
      const hPaid = num(hd.paidAmountUSD);
      const hTotal = num(hd.totalPriceUSD);
      batch.set(ref, {
        subscriberId: doc.id,
        subscriberName: str(s.name, doc.id),
        ...(convincedByUid ? { convincedByUid } : {}),
        cycleNumber: num(hd.renewalNumber, 1),
        package: str(hd.package),
        duration: num(hd.duration),
        startDate: str(hd.startDate),
        expiryDate: str(hd.endDate),
        status: str(hd.snapshotStatus) === "withdrawn" ? "withdrawn" : "completed",
        currencyOriginal: str(hd.currency, "USD"),
        listPriceOriginal: num(hd.totalPrice),
        discountOriginal: 0,
        totalPriceOriginal: num(hd.totalPrice),
        exchangeRate: num(hd.lockedRate, 1) || 1,
        totalPriceUSD: hTotal,
        paidAmountUSD: hPaid,
        remainingAmountUSD: Math.max(0, hTotal - hPaid),
        refundAmountUSD: 0,
        netAmountUSD: Math.max(0, hPaid),
        invoiceId: null,
        backfilled: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "backfill",
      });
    });

    const cycleRef = db.collection("subscriptionCycles").doc();
    let invoiceRef = null;

    if (willInvoice) {
      invoiceRef = db.collection("invoices").doc();
      batch.set(invoiceRef, {
        invoiceNumber,
        subscriberId: doc.id,
        subscriberName: str(s.name, doc.id),
        ...(convincedByUid ? { convincedByUid } : {}),
        cycleId: cycleRef.id,
        cycleNumber: currentCycleNumber,
        issueDate: startDate,
        dueDate: expiryDate,
        currencyOriginal: str(s.currencyOriginal, "USD"),
        subtotalOriginal: num(s.totalPrice),
        discountOriginal: 0,
        totalOriginal: num(s.totalPrice),
        exchangeRate: rate,
        totalUSD: total,
        paidUSD: paid,
        remainingUSD: Math.max(0, total - paid),
        refundedUSD: refunded,
        status,
        // No schedule is invented — see the note at the top of this file.
        paymentPlanType: "full",
        installmentCount: 0,
        notes: null,
        voidedAt: null,
        backfilled: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "backfill",
      });
    }

    batch.set(cycleRef, {
      subscriberId: doc.id,
      subscriberName: str(s.name, doc.id),
      ...(convincedByUid ? { convincedByUid } : {}),
      cycleNumber: currentCycleNumber,
      package: str(s.package),
      duration: num(s.duration),
      startDate,
      expiryDate,
      status: str(s.subscriptionState) === "withdrawn" ? "withdrawn" : "active",
      currencyOriginal: str(s.currencyOriginal, "USD"),
      listPriceOriginal: num(s.totalPrice),
      discountOriginal: 0,
      totalPriceOriginal: num(s.totalPrice),
      exchangeRate: rate,
      totalPriceUSD: total,
      paidAmountUSD: paid,
      remainingAmountUSD: Math.max(0, total - paid),
      refundAmountUSD: refunded,
      netAmountUSD: Math.max(0, paid - refunded),
      invoiceId: invoiceRef ? invoiceRef.id : null,
      backfilled: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "backfill",
    });

    batch.update(doc.ref, {
      currentCycleId: cycleRef.id,
      currentCycleNumber,
      currentInvoiceId: invoiceRef ? invoiceRef.id : null,
      paymentPlanType: "full",
    });

    await batch.commit();
  }

  if (APPLY && stats.invoicesToCreate > 0) {
    await counterRef.set({ sequence, year, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  console.log(APPLY ? "\n=== APPLIED ===" : "\n=== DRY RUN (no writes) ===");
  console.table(stats);
  if (samples.length) {
    console.log("\nSample of what would be created:");
    console.table(samples);
  }
  if (stats.legacyArrayRenewalsSkipped > 0) {
    console.log(
      `\n⚠ ${stats.legacyArrayRenewalsSkipped} renewal(s) live only in the embedded renewals[] array ` +
      `and carry no per-cycle exchange rate. They are NOT reconstructed — a cycle priced at a guessed ` +
      `rate is worse than no cycle at all.`
    );
  }
  if (!APPLY) console.log("\nRe-run with --apply to write. Nothing was changed.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
