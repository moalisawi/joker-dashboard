import { readFileSync } from "node:fs";
import admin from "firebase-admin";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/)
  .filter(l=>l.includes("=")&&!l.startsWith("#"))
  .map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
admin.initializeApp({credential: admin.credential.cert({
  projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: Buffer.from(env.FIREBASE_PRIVATE_KEY_B64,"base64").toString("utf8")})});

const snap = await admin.firestore().collection("subscribers").get();
const rows = [];
snap.forEach(d => { const s = d.data(); if (s.deleted === true) return; rows.push(s); });

const today = new Date().toISOString().slice(0,10);
const daysLeft = (s) => {
  const e = s.expiryDate; if (!e) return 0;
  return Math.ceil((new Date(e) - new Date(today)) / 86400000);
};
// status is computed client-side; approximate it the way getComputedStatus does
const isExpired = (s) => daysLeft(s) <= 0;

const withdrawn = rows.filter(s => s.subscriptionState === "withdrawn").length;
const paused    = rows.filter(s => s.subscriptionStatus === "paused" && s.subscriptionState !== "withdrawn").length;
const frozen    = rows.filter(s => s.freezeData?.isFrozen === true && s.subscriptionState !== "withdrawn").length;

const analytics = rows.filter(s => s.subscriptionState!=="withdrawn" && s.subscriptionStatus!=="paused").length;
const dashboard = rows.filter(s => s.subscriptionState!=="withdrawn" && s.subscriptionStatus!=="paused"
                                && s.freezeData?.isFrozen!==true && !isExpired(s)).length;
const teams     = rows.filter(s => !isExpired(s)).length;
const base      = rows.filter(s => s.subscriptionState!=="withdrawn").length;

console.log(`إجمالي غير المحذوفين : ${rows.length}`);
console.log(`  منسحب ${withdrawn} · موقوف ${paused} · متجمد ${frozen} · منتهٍ ${rows.filter(isExpired).length}`);
console.log(`\n──────── التعريفات الثلاثة اليوم ────────`);
console.log(`  التحليلات        : ${analytics}`);
console.log(`  اللوحة/البطاقات  : ${dashboard}`);
console.log(`  صفحة الفرق       : ${teams}`);
console.log(`\n──────── بعد التوحيد (قرارك) ────────`);
console.log(`  «نشط الآن»       : ${dashboard}`);
console.log(`  «قاعدة العملاء»  : ${base}`);
console.log(`\n──────── ما سيتغيّر على الشاشة ────────`);
console.log(`  التحليلات: ${analytics} → «نشط الآن ${dashboard}» + «قاعدة العملاء ${base}»`);
console.log(`  صفحة الفرق: ${teams} → ${dashboard}`);
process.exit(0);
