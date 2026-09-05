/**
 * auto-migrate.js — joker-52b38 → joker-prod
 * Fully automatic: refreshes token, creates service account keys, migrates data.
 * Run: node auto-migrate.js
 */

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");
const https = require("https");

// ─── Config ───────────────────────────────────────────────────────────────────

const SRC_PROJECT = "joker-52b38";
const DST_PROJECT = "joker-prod";
const BATCH_SIZE  = 400;

const COLLECTIONS = [
  "users",
  "subscribers",
  "payments",
  "refunds",
  "auditLogs",
  "notifications",
  "exchangeRates",
];

// Firebase CLI OAuth credentials
const CLIENT_ID     = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data    = typeof body === "string" ? body : JSON.stringify(body);
    const parsed  = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   "POST",
      headers:  {
        "Content-Type":   headers["Content-Type"] ?? "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(raw); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers:  { Authorization: `Bearer ${token}` },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(raw); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ─── Step 1: Refresh OAuth token ──────────────────────────────────────────────

async function refreshToken(refreshToken) {
  process.stdout.write("🔑 Refreshing OAuth token … ");
  const res = await post(
    "https://oauth2.googleapis.com/token",
    `client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}&refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`,
    { "Content-Type": "application/x-www-form-urlencoded" }
  );
  if (!res.access_token) {
    throw new Error("Token refresh failed: " + JSON.stringify(res));
  }
  console.log("✅");
  return res.access_token;
}

// ─── Step 2: Create service account key ───────────────────────────────────────

async function getFirebaseAdminSA(projectId, token) {
  const res = await get(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts?pageSize=100`,
    token
  );
  if (res.error) throw new Error(`IAM list failed for ${projectId}: ${JSON.stringify(res.error)}`);
  const accounts = res.accounts || [];
  const sa = accounts.find((a) => a.email.startsWith("firebase-adminsdk-"));
  if (!sa) throw new Error(`No firebase-adminsdk service account found in ${projectId}`);
  return sa.email;
}

async function createServiceAccountKey(projectId, saEmail, token) {
  process.stdout.write(`🔐 Creating service account key for ${projectId} … `);
  const res = await post(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${saEmail}/keys`,
    { keyAlgorithm: "KEY_ALG_RSA_2048", privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE" },
    { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  );
  if (res.error) throw new Error(`Key creation failed for ${projectId}: ${JSON.stringify(res.error)}`);
  const keyJson = Buffer.from(res.privateKeyData, "base64").toString("utf8");
  console.log("✅");
  return JSON.parse(keyJson);
}

// ─── Step 3: Migrate collection ───────────────────────────────────────────────

async function migrateCollection(src, dst, name) {
  process.stdout.write(`  📦 ${name} … `);
  const snap = await src.collection(name).get();
  if (snap.empty) { console.log("empty"); return 0; }

  const docs = snap.docs;
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
  return written;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 auto-migrate: joker-52b38 → joker-prod\n");

  // Read Firebase CLI config
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const config     = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const rt         = config.tokens.refresh_token;

  // Step 1: refresh token
  const token = await refreshToken(rt);

  // Step 2: create service account keys
  const srcEmail = await getFirebaseAdminSA(SRC_PROJECT, token);
  const srcKey   = await createServiceAccountKey(SRC_PROJECT, srcEmail, token);

  const dstEmail = await getFirebaseAdminSA(DST_PROJECT, token);
  const dstKey   = await createServiceAccountKey(DST_PROJECT, dstEmail, token);

  // Save keys to disk for inspection / reuse
  fs.writeFileSync(path.join(__dirname, "sa-old.json"), JSON.stringify(srcKey, null, 2));
  fs.writeFileSync(path.join(__dirname, "sa-new.json"), JSON.stringify(dstKey, null, 2));
  console.log("💾 Keys saved to sa-old.json and sa-new.json");

  // IAM keys need ~60s to propagate before they can authenticate
  process.stdout.write("⏳ Waiting 70s for key propagation … ");
  await new Promise((r) => setTimeout(r, 70_000));
  console.log("✅");

  // Step 3: init firebase-admin with two apps
  const srcApp = admin.initializeApp(
    { credential: admin.credential.cert(srcKey), projectId: SRC_PROJECT },
    "source"
  );
  const dstApp = admin.initializeApp(
    { credential: admin.credential.cert(dstKey), projectId: DST_PROJECT },
    "destination"
  );

  const src = srcApp.firestore();
  const dst = dstApp.firestore();

  // Step 4: migrate
  console.log("\n📂 Migrating collections:\n");
  let total = 0;
  const start = Date.now();

  for (const name of COLLECTIONS) {
    total += await migrateCollection(src, dst, name);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done — ${total} documents migrated in ${elapsed}s`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Failed:", err.message);
  process.exit(1);
});
