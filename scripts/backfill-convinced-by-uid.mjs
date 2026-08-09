/**
 * backfill-convinced-by-uid.mjs
 *
 * يملأ حقل `convincedByUid` على وثائق subscribers و payments.
 *
 * لماذا: قواعد الأمان تعزل الموظف على مشتركيه ومدفوعاتهم عبر
 *   resource.data.convincedByUid == request.auth.uid
 * الحقل كان غائباً عن كل الوثائق (٠/٥١ مشترك · ٠/١٣ دفعة)، ووثيقة الدفع لا تحمل
 * أي اسم موظف، فلا يوجد مسار احتياطي بالاسم لها — التعبئة هي الطريق الوحيد.
 * تشغيل هذا السكربت شرط سابق لنشر firestore.rules.
 *
 * الربط: subscriber.convincedBy (اسم ظاهر) ← users.employeeName ← uid
 *        والمدفوعات ترث القيمة من المشترك المرتبط بها عبر subscriberId.
 *
 * الاستخدام (من جذر المشروع):
 *   node scripts/backfill-convinced-by-uid.mjs --dry-run
 *   node scripts/backfill-convinced-by-uid.mjs --apply
 *
 * بلا --apply لا يُكتب شيء. آمن لإعادة التشغيل: يتخطى ما يحمل القيمة أصلاً،
 * ويكتب حقلاً واحداً فقط دون المساس بأي حقل آخر.
 *
 * انظر docs/SECURITY-HARDENING-2026-08.md للسياق الكامل.
 */
import { readFileSync, existsSync } from "fs";

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

/**
 * حسم الأسماء المكررة.
 *
 * `convincedBy` اسم نصّي، و«ميدو» و«حنان» موجودان على حسابين لكلٍّ منهما — فالربط
 * بالاسم وحده يخمّن، وخطأ التخمين يعني منح موظف بيانات عملاء زميله.
 * هذه الخريطة قرار صريح من صاحب المشروع (٢ أغسطس ٢٠٢٦): اختير في الحالتين حساب
 * الموظف صاحب الإيميل، لأن عزل convincedByUid موجَّه للموظفين والمالك يرى كل شيء
 * بغض النظر عن الحقل.
 */
const OVERRIDES = {
  "ميدو": "iyaAg2EVl9a8n75g3Gm6cG2xlfG2", // employee · medo@joker.com
  "حنان": "CNpjjqxcQQfRm8XIB9H0QgK4aSG2", // employee · hanan@joker.com
};

const APPLY = process.argv.includes("--apply");

async function main() {
  loadEnv();
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const keyB64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  const privateKey = keyB64
    ? Buffer.from(keyB64, "base64").toString("utf8")
    : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const db = getFirestore();

  console.log(`المشروع: ${projectId}`);
  console.log(APPLY ? "الوضع: ✍ تنفيذ فعلي\n" : "الوضع: 👁 تجريبي — لن يُكتب شيء\n");

  // ── خريطة الاسم → uid ───────────────────────────────────────────────────────
  const usersSnap = await db.collection("users").get();
  const nameToUid = new Map();
  const collisions = new Set();
  const knownUids = new Set();

  usersSnap.forEach((d) => {
    knownUids.add(d.id);
    const u = d.data();
    for (const candidate of [u.employeeName, u.name]) {
      const key = (candidate ?? "").trim();
      if (!key) continue;
      if (nameToUid.has(key) && nameToUid.get(key) !== d.id) collisions.add(key);
      else if (!nameToUid.has(key)) nameToUid.set(key, d.id);
    }
  });

  // أي تضارب بلا قرار صريح يُتخطّى بدل التخمين.
  const unresolved = [...collisions].filter((k) => !OVERRIDES[k]);
  if (unresolved.length) {
    console.log(`⚠ أسماء مكررة بلا حسم (ستُتخطى): ${unresolved.join(", ")}`);
    unresolved.forEach((k) => nameToUid.delete(k));
  }

  for (const [name, uid] of Object.entries(OVERRIDES)) {
    if (!knownUids.has(uid)) {
      console.error(`✗ توقّف: الـ uid المحدَّد لـ "${name}" غير موجود في users — ${uid}`);
      process.exit(1);
    }
    nameToUid.set(name, uid);
    console.log(`  محسوم: "${name}" → ${uid}`);
  }
  console.log(`\nأسماء قابلة للربط: ${nameToUid.size}`);

  // ── المشتركون ───────────────────────────────────────────────────────────────
  const subsSnap = await db.collection("subscribers").get();
  const subUid = new Map();
  const subUpdates = [];
  const unmatched = new Map();
  let subAlready = 0;

  subsSnap.forEach((d) => {
    const s = d.data();
    const existing = (s.convincedByUid ?? "").trim();
    const name = (s.convincedBy ?? "").trim();
    if (existing) { subUid.set(d.id, existing); subAlready++; return; }
    if (!name) { unmatched.set("(بلا convincedBy)", (unmatched.get("(بلا convincedBy)") ?? 0) + 1); return; }
    const uid = nameToUid.get(name);
    if (!uid) { unmatched.set(name, (unmatched.get(name) ?? 0) + 1); return; }
    subUid.set(d.id, uid);
    subUpdates.push({ ref: d.ref, uid, name });
  });

  console.log(`\n── المشتركون: ${subsSnap.size} ──`);
  console.log(`  سيُحدَّث:            ${subUpdates.length}`);
  console.log(`  يحمل القيمة أصلاً:  ${subAlready}`);
  const byName = {};
  subUpdates.forEach((u) => { byName[u.name] = (byName[u.name] ?? 0) + 1; });
  Object.entries(byName).forEach(([n, c]) => console.log(`      ${n} → ${c}`));
  if (unmatched.size) {
    console.log(`  ⚠ بلا مطابقة:`);
    unmatched.forEach((n, name) => console.log(`      ${name} × ${n}`));
  }

  // ── المدفوعات ───────────────────────────────────────────────────────────────
  const paySnap = await db.collection("payments").get();
  const payUpdates = [];
  let payOrphan = 0, payAlready = 0;

  paySnap.forEach((d) => {
    const p = d.data();
    if ((p.convincedByUid ?? "").trim()) { payAlready++; return; }
    const uid = subUid.get(p.subscriberId);
    if (!uid) { payOrphan++; return; }
    payUpdates.push({ ref: d.ref, uid });
  });

  console.log(`\n── المدفوعات: ${paySnap.size} ──`);
  console.log(`  سيُحدَّث:            ${payUpdates.length}`);
  console.log(`  يحمل القيمة أصلاً:  ${payAlready}`);
  if (payOrphan) console.log(`  ⚠ بلا مشترك مطابق: ${payOrphan} (مشتركوها محذوفون — تبقى للمالك والأدمن)`);

  // ── الكتابة ─────────────────────────────────────────────────────────────────
  const all = [...subUpdates, ...payUpdates];
  if (!APPLY) {
    console.log(`\n👁 تجريبي — ${all.length} وثيقة كانت ستُحدَّث. أضف --apply للتنفيذ.`);
    return;
  }
  if (!all.length) { console.log("\nلا شيء للتحديث."); return; }

  // دفعات من ٤٠٠ (حد Firestore ٥٠٠ عملية للدفعة الواحدة)
  let written = 0;
  for (let i = 0; i < all.length; i += 400) {
    const batch = db.batch();
    for (const u of all.slice(i, i + 400)) batch.update(u.ref, { convincedByUid: u.uid });
    await batch.commit();
    written += Math.min(400, all.length - i);
    console.log(`  كُتب ${written}/${all.length}`);
  }

  const [sa, pa] = await Promise.all([
    db.collection("subscribers").orderBy("convincedByUid").count().get(),
    db.collection("payments").orderBy("convincedByUid").count().get(),
  ]);
  console.log(`\n✅ بعد التنفيذ:`);
  console.log(`  مشتركون فيهم convincedByUid: ${sa.data().count}/${subsSnap.size}`);
  console.log(`  مدفوعات فيها convincedByUid: ${pa.data().count}/${paySnap.size}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
