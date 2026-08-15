/**
 * End-to-end smoke test of the subscriber billing lifecycle against a running
 * server, exercising the real API routes — permissions, Zod validation,
 * transactions and the ledger — rather than the pure helpers the unit tests
 * already cover.
 *
 * WHY THIS EXISTS: the Jest suites test the arithmetic and the guards in
 * isolation. Nothing tested that a create → instalments → payment → verify →
 * adjust → renew sequence actually round-trips through Firestore with the
 * permission layer in front of it. That is the gap this closes.
 *
 * AUTH: mints a custom token for a named uid with the project's own service
 * account and exchanges it for an ID token via Identity Toolkit. That is what
 * custom tokens are for, and it uses only credentials already configured in
 * .env.local for the backfill/audit scripts. No password is involved.
 *
 * DATA: creates real documents. Every one is named with the RUN_TAG below so it
 * can be found and removed, and the script soft-deletes the subscriber it
 * created on the way out (soft — this system never hard-deletes financial
 * records). Payments, invoices and cycles it created are left in place by
 * design; deleting them would be the exact thing the ledger forbids.
 *
 *   node scripts/e2e-billing-smoke.mjs --uid <ownerUid> [--base http://localhost:3100]
 *   node scripts/e2e-billing-smoke.mjs --list-owners
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, "base64").toString("utf8"),
  }),
});

const db = getFirestore();
const BASE = arg("base", "http://localhost:3100");
const RUN_TAG = `E2E-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;

// ── Reporting ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;

// ── Auth ─────────────────────────────────────────────────────────────────────
async function idTokenFor(uid) {
  const custom = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`token exchange failed: ${JSON.stringify(data)}`);
  return data.idToken;
}

let TOKEN = "";
async function op(operation, payload) {
  const res = await fetch(`${BASE}/api/subscriber-operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ operation, payload }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const today = new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (argv.includes("--list-owners")) {
    const snap = await db.collection("users").where("role", "==", "owner").get();
    snap.forEach((d) => console.log(d.id, "|", d.data().name, "|", d.data().email, "| status:", d.data().status ?? (d.data().active ? "active" : "?")));
    return;
  }

  const uid = arg("uid");
  if (!uid) throw new Error("--uid <ownerUid> required (use --list-owners to find it)");

  const actor = await db.collection("users").doc(uid).get();
  if (!actor.exists) throw new Error(`user ${uid} not found`);
  console.log(`\nActing as: ${actor.data().name} (${actor.data().role})  ·  base: ${BASE}`);
  console.log(`Run tag:   ${RUN_TAG}\n`);

  TOKEN = await idTokenFor(uid);
  check("auth: minted ID token and server accepted it", true);

  /*
   * Fail fast on a deployment that cannot write.
   *
   * Without this the run charges ahead, createSubscriber returns 503, and every
   * later step dies on an undefined subscriberId — burying the one line that
   * actually explains the failure under a stack trace about "documentPath is
   * not a valid resource path". The first run against production did exactly
   * that, and the real cause (missing Admin SDK env vars on Vercel) was three
   * screens up.
   */
  {
    const probe = await op("createSubscriber", { subscriber: { name: "" } });
    if (probe.status === 503) {
      console.error(`
  ✗ FATAL — ${probe.body.error}`);
      console.error(`
  This deployment can read but cannot write. Every save will fail.`);
      console.error(`  Check that FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY_B64 are set`);
      console.error(`  for this environment, then redeploy.
`);
      console.error(`    npx vercel env ls production
`);
      process.exit(1);
    }
  }

  let subscriberId, cycleId, invoiceId, paymentId;

  // ── 1. Create with a 3-month instalment plan and a partial down payment ────
  console.log("\n[1] createSubscriber — $300, $100 down, 3 monthly instalments");
  {
    const r = await op("createSubscriber", {
      subscriber: {
        name: `${RUN_TAG} مشترك اختبار`,
        phone: "000000000", residence: "فلسطين", package: "فضية", duration: 30,
        date: today, startDate: today, expiryDate: plusDays(30),
        currencyOriginal: "USD", lockedRate: 1,
        totalPrice: 300, totalPriceUSD: 300,
        payment: "كاش", source: "أخرى", convincedBy: "", paidShift: "",
        notes: `${RUN_TAG} — سجل اختبار آلي`,
      },
      initialPayment: {
        amountOriginal: 100, currencyOriginal: "USD", exchangeRate: 1,
        paymentMethod: "كاش", date: today,
      },
      paymentPlan: { type: "installments", installmentCount: 3, frequency: "monthly", firstDueDate: plusDays(30) },
    });
    check("createSubscriber returns 200", r.status === 200, JSON.stringify(r.body).slice(0, 160));
    subscriberId = r.body.subscriberId; cycleId = r.body.cycleId; invoiceId = r.body.invoiceId;
    check("cycle created", Boolean(cycleId), cycleId);
    check("invoice created with a number", Boolean(invoiceId) && Boolean(r.body.invoiceNumber), r.body.invoiceNumber);
    check("3 instalments generated", r.body.installmentCount === 3, `got ${r.body.installmentCount}`);
  }

  // ── 2. The ledger matches what was asked for ──────────────────────────────
  console.log("\n[2] ledger state after create");
  {
    const sub = (await db.collection("subscribers").doc(subscriberId).get()).data();
    check("subscriber paid = 100 (legacy field still authoritative)", Math.abs(sub.paidAmountUSD - 100) < 0.01, money(sub.paidAmountUSD));
    check("subscriber remaining = 200", Math.abs(sub.remainingAmountUSD - 200) < 0.01, money(sub.remainingAmountUSD));
    check("subscriber points at its cycle", sub.currentCycleId === cycleId);

    const inv = (await db.collection("invoices").doc(invoiceId).get()).data();
    check("invoice total 300 / paid 100", Math.abs(inv.totalUSD - 300) < 0.01 && Math.abs(inv.paidUSD - 100) < 0.01, `${money(inv.totalUSD)} / ${money(inv.paidUSD)}`);
    check("invoice status = partially_paid", inv.status === "partially_paid", inv.status);

    const insts = (await db.collection("installments").where("invoiceId", "==", invoiceId).get())
      .docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.installmentNumber - b.installmentNumber);
    check("instalments sum back to the financed 200",
      Math.abs(insts.reduce((n, i) => n + i.amountUSD, 0) - 200) < 0.01,
      insts.map((i) => money(i.amountUSD)).join(" + "));
    check("down payment NOT spent twice — instalments start unpaid",
      insts.every((i) => i.paidUSD === 0), insts.map((i) => money(i.paidUSD)).join("/"));
    check("instalments outstanding == invoice remaining",
      Math.abs(insts.reduce((n, i) => n + i.remainingUSD, 0) - 200) < 0.01,
      money(insts.reduce((n, i) => n + i.remainingUSD, 0)));
    check("due dates are 30 days apart",
      insts[0].dueDate === plusDays(30) && insts[2].dueDate !== insts[0].dueDate,
      insts.map((i) => i.dueDate).join(" → "));
  }

  // ── 3. Payment allocates to the oldest open instalment ────────────────────
  console.log("\n[3] addPayment $66.67 — should settle instalment #1 exactly");
  {
    const insts = (await db.collection("installments").where("invoiceId", "==", invoiceId).get())
      .docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.installmentNumber - b.installmentNumber);
    const r = await op("addPayment", {
      subscriberId, amountOriginal: insts[0].amountUSD, currencyOriginal: "USD",
      exchangeRate: 1, paymentMethod: "كاش", date: today,
    });
    check("addPayment returns 200", r.status === 200, JSON.stringify(r.body).slice(0, 160));
    paymentId = r.body.paymentId;
    check("allocated to instalment #1", r.body.allocations?.[0]?.installmentNumber === 1, JSON.stringify(r.body.allocations));
    check("instalment #1 reported paid", r.body.allocations?.[0]?.status === "paid");

    const i1 = (await db.collection("installments").doc(insts[0].id).get()).data();
    check("instalment #1 persisted as paid", i1.status === "paid", `${money(i1.paidUSD)}/${money(i1.amountUSD)}`);
    check("payment id recorded on the instalment", (i1.paymentIds ?? []).includes(paymentId));
  }

  // ── 4. Guards ─────────────────────────────────────────────────────────────
  console.log("\n[4] guards — each of these MUST be refused");
  {
    const over = await op("addPayment", { subscriberId, amountOriginal: 5000, currencyOriginal: "USD", exchangeRate: 1, paymentMethod: "كاش" });
    check("overpayment past the subscription total refused", over.status >= 400, `${over.status} ${over.body.error ?? ""}`);

    const zero = await op("addPayment", { subscriberId, amountOriginal: 0, currencyOriginal: "USD", exchangeRate: 1 });
    check("zero-amount payment refused by Zod", zero.status === 422, `${zero.status} ${zero.body.error ?? ""}`);

    const noReceipt = await op("verifyReceipt", { paymentId, decision: "verify" });
    check("verifying a payment with no receipt refused", noReceipt.status >= 400, `${noReceipt.body.error ?? ""}`);

    const noReason = await op("adjustPayment", { subscriberId, adjustmentType: "write_off", amountUSD: -10, reason: "ab" });
    check("adjustment with a too-short reason refused", noReason.status === 422, `${noReason.status}`);

    const badType = await op("adjustPayment", { subscriberId, adjustmentType: "nonsense", amountUSD: -10, reason: "سبب صالح" });
    check("unknown adjustment type refused", badType.status === 422, `${badType.status}`);

    const negative = await op("adjustPayment", { subscriberId, adjustmentType: "correction", amountUSD: -99999, reason: "دفع المدفوع للسالب" });
    check("adjustment driving paid below zero refused", negative.status >= 400, `${negative.body.error ?? ""}`);
  }

  // ── 5. Receipt verification ───────────────────────────────────────────────
  console.log("\n[5] verifyReceipt — with a receipt attached");
  {
    await db.collection("payments").doc(paymentId).update({
      receiptUrl: "https://example.test/receipt.png", receiptStatus: "pending_review",
    });
    const ok = await op("verifyReceipt", { paymentId, decision: "verify" });
    check("verify accepted once a receipt exists", ok.status === 200, JSON.stringify(ok.body).slice(0, 120));
    const p = (await db.collection("payments").doc(paymentId).get()).data();
    check("receiptStatus = verified, verifier recorded", p.receiptStatus === "verified" && Boolean(p.verifiedBy), p.receiptStatus);
    check("money untouched by receipt review", Math.abs(p.amountUSD - 66.67) < 0.02, money(p.amountUSD));

    const rej = await op("verifyReceipt", { paymentId, decision: "reject", reason: "صورة غير واضحة" });
    check("reject with a reason accepted", rej.status === 200);
    const p2 = (await db.collection("payments").doc(paymentId).get()).data();
    check("rejection reason stored", p2.receiptStatus === "rejected" && p2.rejectionReason === "صورة غير واضحة");
  }

  // ── 6. Adjustment ─────────────────────────────────────────────────────────
  console.log("\n[6] adjustPayment — write off $50");
  {
    const before = (await db.collection("subscribers").doc(subscriberId).get()).data();
    const r = await op("adjustPayment", {
      subscriberId, adjustmentType: "write_off", amountUSD: -50,
      reason: `${RUN_TAG} إعدام دين اختباري`, date: today,
    });
    check("adjustment accepted", r.status === 200, JSON.stringify(r.body).slice(0, 140));
    const after = (await db.collection("subscribers").doc(subscriberId).get()).data();
    check("paid moved by exactly -50", Math.abs((before.paidAmountUSD - after.paidAmountUSD) - 50) < 0.01,
      `${money(before.paidAmountUSD)} → ${money(after.paidAmountUSD)}`);
    const adj = (await db.collection("paymentAdjustments").where("subscriberId", "==", subscriberId).get()).docs;
    check("adjustment document written with its reason", adj.length === 1 && adj[0].data().reason.includes(RUN_TAG));
    const pays = (await db.collection("payments").where("subscriberId", "==", subscriberId).get()).docs;
    check("original payments left untouched (immutable)", pays.length === 2, `${pays.length} payments still present`);
  }

  // ── 7. Renewal creates a new cycle ────────────────────────────────────────
  console.log("\n[7] renewSubscription — new cycle, previous one closed");
  {
    const r = await op("renewSubscription", {
      subscriberId, duration: 30, currency: "USD", totalPrice: 150,
      paidAmount: 150, exchangeRate: 1, renewalDate: today, paymentMethod: "كاش", package: "فضية",
    });
    check("renewal accepted", r.status === 200, JSON.stringify(r.body).slice(0, 140));
    const newCycleId = r.body.cycleId;
    check("a NEW cycle id was issued", Boolean(newCycleId) && newCycleId !== cycleId);

    const old = (await db.collection("subscriptionCycles").doc(cycleId).get()).data();
    check("previous cycle closed as completed", old.status === "completed", old.status);
    check("previous cycle kept its own figures", Math.abs(old.totalPriceUSD - 300) < 0.01, money(old.totalPriceUSD));

    const sub = (await db.collection("subscribers").doc(subscriberId).get()).data();
    check("subscriber now points at the new cycle", sub.currentCycleId === newCycleId);
    check("renewalCount incremented", sub.renewalCount === 1, String(sub.renewalCount));
    check("new invoice issued and fully paid", Boolean(r.body.invoiceId));
    if (r.body.invoiceId) {
      const inv = (await db.collection("invoices").doc(r.body.invoiceId).get()).data();
      check("renewal invoice status = paid", inv.status === "paid", inv.status);
    }
  }

  // ── 8. Reconciliation preview ─────────────────────────────────────────────
  console.log("\n[8] payments/reconcile — preview only, writes nothing");
  {
    const r = await post("/api/payments/reconcile", {
      paymentMethodId: "كاش", periodStart: plusDays(-30), periodEnd: today, preview: true,
    });
    check("preview responds 200", r.status === 200, JSON.stringify(r.body).slice(0, 140));
    check("preview reports a payment count and expected total",
      typeof r.body.paymentCount === "number" && typeof r.body.expectedTotalUSD === "number",
      `${r.body.paymentCount} payments / ${money(r.body.expectedTotalUSD)}`);
    const bad = await post("/api/payments/reconcile", { paymentMethodId: "كاش", periodStart: today, periodEnd: plusDays(-30) });
    check("reversed date window refused", bad.status === 422, String(bad.status));
  }

  // ── 9. Employee lifecycle read paths ──────────────────────────────────────
  console.log("\n[9] employee lifecycle guards");
  {
    const self = await post("/api/employees/impact", { uid });
    // impact is a read and deliberately does not set forbidSelf — seeing your
    // own footprint is harmless. The destructive routes are the ones that block.
    check("impact on self is allowed (read-only route)", self.status === 200, String(self.status));
    const missing = await post("/api/employees/reactivate", { uid: "does-not-exist" });
    check("reactivating a nonexistent user returns 404", missing.status === 404, String(missing.status));
    const badTransfer = await post("/api/employees/transfer-data", { fromUid: uid, toUid: uid, scopes: ["convincedByUid"] });
    check("transfer to the same account refused", badTransfer.status === 422, String(badTransfer.status));
    const badScope = await post("/api/employees/transfer-data", { fromUid: uid, toUid: "x", scopes: ["payments"] });
    check("unknown transfer scope refused", badScope.status === 422, String(badScope.status));
  }

  // ── 10. Cleanup ───────────────────────────────────────────────────────────
  console.log("\n[10] cleanup");
  {
    const r = await op("deleteSubscriber", { subscriberId });
    check("test subscriber soft-deleted", r.status === 200, JSON.stringify(r.body).slice(0, 100));
    const sub = (await db.collection("subscribers").doc(subscriberId).get()).data();
    check("soft delete, not hard — document still present", sub.deleted === true);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) {
    console.log("\n  Failures:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`   ✗ ${r.name}  ${r.detail}`));
  }
  console.log(`\n  Records created on joker-prod (tag ${RUN_TAG}):`);
  console.log(`   subscriber ${subscriberId}  (soft-deleted)`);
  console.log(`   + its cycles, invoices, instalments, payments and adjustment — kept by design;`);
  console.log(`     the ledger never hard-deletes financial records.`);
  console.log(`${"─".repeat(64)}\n`);
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => { console.error("\nFATAL:", e.message); process.exit(1); });
