/**
 * import-subscribers.mjs
 * يستورد بيانات المشتركين التاريخية من ملف CSV إلى Firestore
 *
 * الاستخدام:
 *   node scripts/import-subscribers.mjs --file=subscribers-import.csv
 *   node scripts/import-subscribers.mjs --file=subscribers-import.csv --dry-run
 *
 * --dry-run  : يعرض البيانات المعالجة بدون كتابة أي شيء في Firestore
 * --file     : مسار ملف CSV (الافتراضي: scripts/subscribers-import.csv)
 *
 * أعمدة CSV المطلوبة وتنسيقها موجودة في: scripts/subscribers-template.csv
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID }               from "crypto";

// ─── ثوابت ────────────────────────────────────────────────────────────────────

const DEFAULT_RATES = { USD: 1, EGP: 47.5, JOD: 0.71, ILS: 3.65 };

const VALID_PACKAGES   = ["فضية", "ذهبية"];
const VALID_CURRENCIES = ["USD", "EGP", "JOD", "ILS"];
const VALID_STATES     = ["active", "withdrawn"];

// ─── تحميل .env.local ─────────────────────────────────────────────────────────

function loadEnv() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^"(.*)"$/s, "$1").replace(/\\n/g, "\n");
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

// ─── CSV Parser بسيط يدعم الحقول المقتبسة والعربية ───────────────────────────

function parseCSV(content) {
  // إزالة BOM إذا وُجد
  const raw = content.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  function parseLine(line) {
    const fields = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line, i) => {
    const values = parseLine(line);
    const row = { _lineNumber: i + 2 };
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    return row;
  });
}

// ─── مساعدات التاريخ ──────────────────────────────────────────────────────────

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().split("T")[0];
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / 86_400_000);
}

function inferStatus(daysRemaining, state) {
  if (state === "withdrawn") return "منسحب";
  if (daysRemaining < 0)    return "منتهي";
  if (daysRemaining <= 7)   return "ينتهي قريباً";
  return "نشط";
}

function inferSubscriptionStatus(daysRemaining, state) {
  if (state === "withdrawn") return "withdrawn";
  if (daysRemaining < 0)    return "expired";
  return "active";
}

// ─── معالجة صف واحد ───────────────────────────────────────────────────────────

function processRow(raw) {
  const errors = [];
  const warnings = [];

  const g = (key, def = "") => (raw[key] ?? "").trim() || def;

  // ── الحقول الإلزامية ────────────────────────────────────────────────────────
  const name      = g("name");
  const phone     = g("phone");
  const residence = g("residence");
  const pkg       = g("package");
  const startDate = g("startDate");
  const currency  = g("currency", "USD");

  if (!name)      errors.push("name مفقود");
  if (!phone)     errors.push("phone مفقود");
  if (!residence) errors.push("residence مفقود");
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    errors.push("startDate مفقود أو تنسيق خاطئ (YYYY-MM-DD)");
  if (!VALID_PACKAGES.includes(pkg))
    errors.push(`package يجب أن يكون: ${VALID_PACKAGES.join(" أو ")} — القيمة: "${pkg}"`);
  if (!VALID_CURRENCIES.includes(currency))
    errors.push(`currency يجب أن يكون: ${VALID_CURRENCIES.join("/")} — القيمة: "${currency}"`);

  const duration = Number(g("duration", "1"));
  if (!duration || duration <= 0) errors.push("duration يجب أن يكون رقم موجب");

  const totalPrice = Number(g("totalPrice", "0"));
  if (isNaN(totalPrice)) errors.push("totalPrice غير صالح");

  if (errors.length > 0) return { ok: false, errors, warnings };

  // ── السعر الصرف والمبالغ بالدولار ───────────────────────────────────────────
  const rawRate = g("lockedRate");
  const lockedRate = rawRate ? Number(rawRate) : DEFAULT_RATES[currency];
  if (!lockedRate || lockedRate <= 0) errors.push("lockedRate غير صالح");

  const paidAmount     = Number(g("paidAmount", String(totalPrice)));
  const remainingAmt   = totalPrice - paidAmount;
  const totalPriceUSD  = parseFloat((totalPrice / lockedRate).toFixed(2));
  const paidAmountUSD  = parseFloat((paidAmount / lockedRate).toFixed(2));
  const remainingUSD   = parseFloat((remainingAmt / lockedRate).toFixed(2));
  const netAmountUSD   = paidAmountUSD; // بدون رسوم افتراضياً

  // ── التواريخ والحالة ─────────────────────────────────────────────────────────
  const expiryDate    = addMonths(startDate, duration);
  const daysRemaining = daysUntil(expiryDate);
  const state         = VALID_STATES.includes(g("subscriptionState")) ? g("subscriptionState") : "active";
  const status        = inferStatus(daysRemaining, state);
  const subStatus     = inferSubscriptionStatus(daysRemaining, state);

  if (daysRemaining < 0 && state === "active")
    warnings.push(`الاشتراك منتهي (${Math.abs(daysRemaining)} يوم) — سيُضاف كـ "منتهي"`);

  // ── تاريخ الإدخال ────────────────────────────────────────────────────────────
  const entryDate = g("date", startDate);

  // ── الحقول الاختيارية ────────────────────────────────────────────────────────
  const dialCode     = g("dialCode", "+962");
  const phoneCountry = g("phoneCountry", "JO");
  const payment      = g("payment", "نقد");
  const convincedBy  = g("convincedBy", "");
  const team         = g("team", "");
  const source       = g("source", "");
  const notes        = g("notes", "");
  const referrer     = g("referrer", "");
  const paidShift    = g("paidShift", "");
  const age          = g("age") ? Number(g("age")) : null;

  const doc = {
    id:               randomUUID(),
    date:             entryDate,
    startDate,
    name,
    residence,
    phoneCountry,
    dialCode,
    phone,
    ...(age !== null ? { age } : {}),
    package:          pkg,
    duration,
    expiryDate,
    daysRemaining,
    status,

    // Pricing
    currencyOriginal: currency,
    currency,
    lockedRate,
    totalPrice,
    totalPriceUSD,
    paidAmount,
    paidAmountUSD,
    remainingAmount:  remainingAmt,
    remainingAmountUSD: remainingUSD,
    netAmountUSD,

    // Payment
    payment,
    source,
    ...(referrer ? { referrer } : {}),
    convincedBy,
    paidShift,
    team,
    ...(notes ? { notes } : {}),

    // State
    subscriptionState:  state,
    subscriptionStatus: subStatus,

    // Renewal lifecycle
    renewals:         [],
    renewalCount:     0,
    lifetimeValueUSD: paidAmountUSD,
    lastRenewalDate:  null,

    // Meta — سيتم تعيين createdAt كـ Timestamp أثناء الكتابة
    _isHistorical: true,
  };

  return { ok: true, doc, errors: [], warnings };
}

// ─── Batch كتابة في Firestore ──────────────────────────────────────────────────

async function writeBatches(db, Timestamp, docs, dryRun) {
  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    if (dryRun) {
      written += chunk.length;
      continue;
    }

    const batch = db.batch();
    const now   = Timestamp.now();

    for (const doc of chunk) {
      const { _isHistorical, ...data } = doc;
      void _isHistorical;
      const ref = db.collection("subscribers").doc(data.id);
      batch.set(ref, {
        ...data,
        createdAt: now,
        updatedAt: now,
        createdBy: "import-script",
        updatedBy: "import-script",
      });
    }

    await batch.commit();
    written += chunk.length;
    process.stdout.write(`  ✓ ${written}/${docs.length} مكتوب...\r`);
  }

  return written;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  // قراءة المعاملات
  const argv = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, "").split("=");
      return [k, v.join("=") || true];
    })
  );

  const csvFile = argv.file ?? "scripts/subscribers-import.csv";
  const dryRun  = argv["dry-run"] === true || argv["dry-run"] === "true";

  console.log("═══════════════════════════════════════════");
  console.log("  استيراد بيانات المشتركين — Joker Dashboard");
  console.log("═══════════════════════════════════════════");
  if (dryRun) console.log("  ⚠  وضع المعاينة (dry-run) — لن يُكتب شيء\n");

  // قراءة CSV
  if (!existsSync(csvFile)) {
    console.error(`\n✕ ملف CSV غير موجود: ${csvFile}`);
    console.error("  استخدم --file=<مسار الملف> أو انسخ قالب CSV إلى scripts/subscribers-import.csv");
    process.exit(1);
  }

  const rawCSV = readFileSync(csvFile, "utf8");
  const rows   = parseCSV(rawCSV);
  console.log(`  ${rows.length} صف في ملف CSV\n`);

  // معالجة كل صف
  const validDocs = [];
  const skipped   = [];

  for (const row of rows) {
    const result = processRow(row);
    if (!result.ok) {
      skipped.push({ line: row._lineNumber, name: row.name || "—", errors: result.errors });
      continue;
    }
    if (result.warnings.length > 0) {
      console.log(`  ⚠  سطر ${row._lineNumber} (${row.name}): ${result.warnings.join(" | ")}`);
    }
    validDocs.push(result.doc);
  }

  console.log(`\n  صالح للاستيراد: ${validDocs.length}`);
  console.log(`  مرفوض (أخطاء): ${skipped.length}`);

  if (skipped.length > 0) {
    console.log("\n─── السجلات المرفوضة ───────────────────────");
    for (const s of skipped) {
      console.log(`  سطر ${s.line} — ${s.name}`);
      for (const e of s.errors) console.log(`     • ${e}`);
    }
  }

  if (validDocs.length === 0) {
    console.log("\n  لا يوجد بيانات صالحة. تأكد من تنسيق CSV.");
    process.exit(0);
  }

  if (dryRun) {
    console.log("\n─── عينة من البيانات المعالجة (أول 3) ──────");
    for (const d of validDocs.slice(0, 3)) {
      console.log(`  ${d.name} | ${d.package} | ${d.startDate} → ${d.expiryDate} | ${d.paidAmountUSD} USD | ${d.status}`);
    }
    console.log("\n  ✓ dry-run مكتمل. شغّل بدون --dry-run للاستيراد الفعلي.");
    process.exit(0);
  }

  // تهيئة Firebase Admin
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore, Timestamp }       = await import("firebase-admin/firestore");

  const projectId   = process.env.FIREBASE_PROJECT_ID   ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("\n✕ بيانات Firebase Admin غير مكتملة في .env.local");
    console.error("  يجب أن تتوفر: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore();

  // تأكيد قبل الكتابة
  console.log(`\n  سيتم كتابة ${validDocs.length} مشترك إلى Firestore...`);
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  await new Promise((resolve) => {
    rl.question("  هل تريد المتابعة؟ (y/n): ", (ans) => {
      rl.close();
      if (ans.toLowerCase() !== "y") {
        console.log("  ألغيت العملية.");
        process.exit(0);
      }
      resolve();
    });
  });

  console.log("\n  جاري الكتابة...");
  const written = await writeBatches(db, Timestamp, validDocs, false);

  console.log(`\n\n═══════════════════════════════════════════`);
  console.log(`  ✓ اكتملت العملية`);
  console.log(`  مستورد:  ${written}`);
  console.log(`  مرفوض:   ${skipped.length}`);
  console.log(`  المجموع: ${rows.length}`);
  console.log(`═══════════════════════════════════════════`);
}

main().catch((e) => { console.error("\n✕ خطأ:", e.message); process.exit(1); });
