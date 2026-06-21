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

  const snap = await db.collection("subscribers").where("seedSource", "==", "fake-demo-seed").get();
  console.log(`سيتم حذف ${snap.size} مشترك مزيف...`);

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  console.log(`✓ تم حذف ${snap.size} مشترك مزيف`);
}

main().catch((e) => { console.error(e); process.exit(1); });
