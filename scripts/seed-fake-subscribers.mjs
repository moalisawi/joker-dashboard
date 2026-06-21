/**
 * seed-fake-subscribers.mjs
 * يولّد مشتركين مزيفين (fake) لكن واقعيين بنفس شكل البيانات الحقيقية الموجودة في Firestore،
 * ويكتبهم مباشرة في مجموعة "subscribers".
 *
 * الاستخدام:
 *   node scripts/seed-fake-subscribers.mjs --count=40
 *   node scripts/seed-fake-subscribers.mjs --count=40 --dry-run
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";

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

// ─── مرجع البيانات الحقيقية (مطابق لما هو موجود حالياً في الإنتاج) ──────────────

const EMPLOYEES = ["ميدو", "ميار", "حنان"];
const TEAMS = ["فريق الشباب", "عبدالله طلبة", "فريق البنات", "فريق المبيعات"];
const PAYMENT_METHODS = [
  "PayPal", "محفظة موبايل", "زين كاش", "انستاباي", "ويسترن يونيون",
  "كريبتو / USDT", "فودافون كاش", "كاش", "حوالة بنكية",
  "حوالة بنكية بنك الداخل", "محفظة جوال باي", "محفظة بال باي",
];
const SOURCES = ["إعلان فيسبوك", "إعلان انستجرام", "سوشيال ميديا", "ترشيح", "بحث", "أخرى"];
const DURATIONS = [15, 30, 60, 90];

// residence -> { phoneCountry, dialCode, currency, lockedRate }
const RESIDENCES = [
  { residence: "فلسطين-غزة",    phoneCountry: "IL", dialCode: "+970", currency: "ILS", lockedRate: 3 },
  { residence: "فلسطين-الضفة",  phoneCountry: "IL", dialCode: "+970", currency: "ILS", lockedRate: 3 },
  { residence: "فلسطين-الداخل", phoneCountry: "IL", dialCode: "+972", currency: "ILS", lockedRate: 3 },
  { residence: "JO",            phoneCountry: "JO", dialCode: "+962", currency: "JOD", lockedRate: 0.71 },
  { residence: "EG",            phoneCountry: "EG", dialCode: "+20",  currency: "EGP", lockedRate: 47.5 },
  { residence: "SA",            phoneCountry: "SA", dialCode: "+966", currency: "USD", lockedRate: 1 },
  { residence: "AE",            phoneCountry: "AE", dialCode: "+971", currency: "USD", lockedRate: 1 },
  { residence: "QA",            phoneCountry: "QA", dialCode: "+974", currency: "USD", lockedRate: 1 },
  { residence: "US",            phoneCountry: "US", dialCode: "+1",   currency: "USD", lockedRate: 1 },
];

const FIRST_NAMES_M = [
  "أحمد","محمد","يوسف","عمر","خالد","حمزة","معاذ","سامر","طارق","زياد",
  "إبراهيم","حسام","فادي","نور الدين","عبدالله","سيف","وسيم","منتصر","نسيم","فتحي",
  "مهند","باسل","رامي","قيس","عدنان",
];
const FIRST_NAMES_F = [
  "سارة","فاطمة","مريم","هند","ريم","نور","رنا","ياسمين","دانة","لين",
  "رؤى","أمل","شيماء","غدير","تالا","ميس","جنى","علا","رهف","سهر",
];
const FATHER_NAMES = [
  "محمد","علي","حسن","خليل","يوسف","إبراهيم","سعيد","جمال","ناصر","وليد",
  "رمزي","طلال","فؤاد","سمير","عماد","رشيد","زكريا","صبحي","نبيل","كمال",
];
const LAST_NAMES = [
  "الخطيب","التعمري","الرموني","الشهواني","البرغوثي","العقاد","حماد","شاهين","نصار","قاسم",
  "العمري","زيدان","حمدان","المصري","صالح","دياب","عوض","الحموري","شعبان","البطش",
];

function pick(arr) { return arr[Math.floor(seededRandom() * arr.length)]; }
function pickInt(min, max) { return Math.floor(seededRandom() * (max - min + 1)) + min; }

// ─── مولّد أرقام عشوائي بسيط (deterministic عند تمرير seed ثابت غير مطلوب هنا) ──
let _seed = 42;
function seededRandom() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}

function randomPhone(phoneCountry) {
  switch (phoneCountry) {
    case "IL": return String(5_00_000_000 + pickInt(0, 99_999_999)).slice(0, 9);
    case "JO": return "7" + String(pickInt(70_000_000, 99_999_999)).slice(0, 8);
    case "EG": return "1" + String(pickInt(0, 99_999_999)).padStart(9, "0").slice(0, 9);
    case "SA": return "5" + String(pickInt(0, 99_999_999)).padStart(8, "0").slice(0, 8);
    case "AE": return "5" + String(pickInt(0, 9_999_999)).padStart(8, "0").slice(0, 8);
    case "QA": return "3" + String(pickInt(0, 9_999_999)).padStart(7, "0").slice(0, 7);
    case "US": return String(pickInt(2_000_000_000, 9_999_999_999)).slice(0, 10);
    default:   return String(pickInt(100_000_000, 999_999_999));
  }
}

function randomName() {
  const isMale = seededRandom() < 0.65;
  const first = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
  return `${first} ${pick(FATHER_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomDateInMonth(year, month) {
  const day = pickInt(1, 30);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr) - today) / 86_400_000);
}

// Pricing roughly matching real data: فضية ~ $35/month, ذهبية ~ $75/month equivalent
function basePriceUSD(pkg, duration) {
  const monthly = pkg === "ذهبية" ? 75 : 35;
  const months = duration / 30;
  const jitter = 0.85 + seededRandom() * 0.3; // ±15%
  return Math.round(monthly * months * jitter);
}

// ─── توليد مشترك واحد ───────────────────────────────────────────────────────────

function makeFakeSubscriber() {
  const loc = pick(RESIDENCES);
  const pkg = seededRandom() < 0.4 ? "ذهبية" : "فضية";
  const duration = pick(DURATIONS);
  const startDate = randomDateInMonth(2026, 6);
  const expiryDate = addDays(startDate, duration);
  const daysRemaining = daysUntil(expiryDate);

  const totalPriceUSD = basePriceUSD(pkg, duration);
  const totalPrice = Math.round(totalPriceUSD * loc.lockedRate * 100) / 100;

  // توزيع واقعي للحالات: أغلبها نشط/منتهي قريباً، وبعضها منتهٍ أو منسحب أو متوقف
  const roll = seededRandom();
  let subscriptionState = "active";
  let subscriptionStatus = "active";
  let paidRatio = 1; // نسبة المدفوع من الإجمالي

  if (roll < 0.08) {
    subscriptionState = "withdrawn";
    subscriptionStatus = "withdrawn";
  } else if (roll < 0.13) {
    subscriptionStatus = "paused";
  } else if (daysRemaining < 0) {
    subscriptionStatus = "expired";
  }

  if (subscriptionState === "active" && subscriptionStatus === "active" && seededRandom() < 0.15) {
    paidRatio = 0.5 + seededRandom() * 0.4; // دفعة جزئية
  }

  const paidAmountUSD = Math.round(totalPriceUSD * paidRatio * 100) / 100;
  const paidAmount = Math.round(paidAmountUSD * loc.lockedRate * 100) / 100;
  const remainingAmountUSD = Math.round((totalPriceUSD - paidAmountUSD) * 100) / 100;
  const remainingAmount = Math.round(remainingAmountUSD * loc.lockedRate * 100) / 100;

  const employee = pick(EMPLOYEES);

  const name = randomName();
  const doc = {
    id: randomUUID(),
    date: startDate,
    startDate,
    name,
    residence: loc.residence,
    phoneCountry: loc.phoneCountry,
    dialCode: loc.dialCode,
    phone: randomPhone(loc.phoneCountry),
    age: pickInt(19, 45),
    package: pkg,
    duration,
    expiryDate,

    currencyOriginal: loc.currency,
    currency: loc.currency,
    lockedRate: loc.lockedRate,
    totalPrice,
    totalPriceUSD,
    amount: totalPrice,
    amountUSD: totalPriceUSD,
    paidAmount,
    paidAmountUSD,
    remainingAmount,
    remainingAmountUSD,
    netAmountUSD: paidAmountUSD,

    payment: pick(PAYMENT_METHODS),
    source: pick(SOURCES),
    referrer: "",
    convincedBy: employee,
    paidShift: employee,
    team: pick(TEAMS),
    notes: "",

    subscriptionState,
    subscriptionStatus,
    refundAmount: 0,
    refundAmountUSD: 0,

    renewals: [],
    renewalCount: 0,
    lifetimeValueUSD: paidAmountUSD,
    lastRenewalDate: null,

    seedSource: "fake-demo-seed",
  };

  if (subscriptionState === "withdrawn") {
    doc.withdrawalReason = pick(["السعر مرتفع", "غير راضٍ عن الخدمة", "سافر/تغيرت ظروفه", "لم يستفد"]);
    doc.withdrawnAt = addDays(startDate, pickInt(5, duration));
  }
  if (subscriptionStatus === "paused") {
    doc.pauseReason = pick(["سفر مؤقت", "ظروف صحية", "ظروف مالية"]);
    doc.remainingDaysAtPause = Math.max(daysRemaining, 1);
  }

  return doc;
}

// ─── Batch كتابة في Firestore ──────────────────────────────────────────────────

async function writeBatches(db, Timestamp, docs) {
  const BATCH_SIZE = 400;
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    const now = Timestamp.now();
    for (const doc of chunk) {
      const ref = db.collection("subscribers").doc(doc.id);
      batch.set(ref, {
        ...doc,
        createdAt: now,
        updatedAt: now,
        createdBy: "fake-seed-script",
        updatedBy: "fake-seed-script",
      });
    }
    await batch.commit();
    written += chunk.length;
    process.stdout.write(`  ✓ ${written}/${docs.length} مكتوب...\r`);
  }
  return written;
}

async function main() {
  loadEnv();

  const argv = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, "").split("=");
      return [k, v.join("=") || true];
    })
  );

  const count = Number(argv.count ?? 30);
  const dryRun = argv["dry-run"] === true || argv["dry-run"] === "true";

  console.log("═══════════════════════════════════════════");
  console.log(`  توليد ${count} مشترك مزيف (fake) — Joker Dashboard`);
  console.log("═══════════════════════════════════════════");
  if (dryRun) console.log("  ⚠  وضع المعاينة (dry-run) — لن يُكتب شيء\n");

  const docs = Array.from({ length: count }, makeFakeSubscriber);

  console.log("\n─── عينة من البيانات المولّدة (أول 5) ──────");
  for (const d of docs.slice(0, 5)) {
    console.log(`  ${d.name} | ${d.residence} | ${d.package} | ${d.startDate} → ${d.expiryDate} | $${d.paidAmountUSD}/${d.totalPriceUSD} | ${d.subscriptionState}/${d.subscriptionStatus}`);
  }

  if (dryRun) {
    console.log("\n  ✓ dry-run مكتمل. شغّل بدون --dry-run للكتابة الفعلية.");
    return;
  }

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore, Timestamp } = await import("firebase-admin/firestore");

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const keyB64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  const privateKey = keyB64
    ? Buffer.from(keyB64, "base64").toString("utf8")
    : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("\n✕ بيانات Firebase Admin غير مكتملة في .env.local");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const db = getFirestore();

  console.log(`\n  جاري الكتابة...`);
  const written = await writeBatches(db, Timestamp, docs);

  console.log(`\n\n═══════════════════════════════════════════`);
  console.log(`  ✓ تمت إضافة ${written} مشترك مزيف بنجاح`);
  console.log(`═══════════════════════════════════════════`);
}

main().catch((e) => { console.error("\n✕ خطأ:", e.message); process.exit(1); });
