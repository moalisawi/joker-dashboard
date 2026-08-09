/**
 * Account audit for joker-prod.
 *
 * Lists every Firebase Auth identity joined with its /users profile, flags
 * profiles whose Auth account no longer exists, and can disable an account by
 * email.
 *
 * Read-only unless --disable is passed. Accounts are *disabled*, never deleted:
 * a uid is referenced by `convincedByUid` on subscribers and payments, and the
 * employee row-level rules in firestore.rules read that field, so deleting a uid
 * orphans records with no way back. Disabling revokes access and is one call to
 * undo.
 *
 *   node scripts/audit-accounts.mjs                          # report only
 *   node scripts/audit-accounts.mjs --disable someone@x.com  # revoke access
 *   node scripts/audit-accounts.mjs --enable  someone@x.com  # undo
 *
 * Requires the admin credentials in .env.local.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(`${ROOT}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};
const disableEmail = flagValue("--disable");
const enableEmail = flagValue("--enable");

if ((disableEmail ?? enableEmail) === undefined) {
  console.error("--disable / --enable need an email address.");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, "base64").toString("utf8"),
  }),
});

const auth = getAuth();
const db = getFirestore();

const profiles = new Map(
  (await db.collection("users").get()).docs.map((d) => [d.id, d.data()])
);
const { users } = await auth.listUsers(1000);

/** How many records would be orphaned if this uid went away. */
async function ownedCounts(uid) {
  const counts = {};
  for (const coll of ["subscribers", "payments"]) {
    counts[coll] = (await db.collection(coll).where("convincedByUid", "==", uid).count().get()).data().count;
  }
  return counts;
}

// ── report ──────────────────────────────────────────────────────────────────
const rows = [];
for (const u of users) {
  const p = profiles.get(u.uid) ?? {};
  const owned = await ownedCounts(u.uid);
  rows.push({
    email: u.email ?? "—",
    name: p.employeeName || p.name || u.displayName || "—",
    role: p.role ?? "—",
    disabled: u.disabled ? "YES" : "",
    active: p.isActive === false ? "no" : "yes",
    subs: owned.subscribers,
    payments: owned.payments,
    lastSignIn: u.metadata.lastSignInTime?.slice(0, 16) ?? "never",
  });
}
rows.sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));
console.table(rows);

const orphans = [...profiles.keys()].filter((uid) => !users.some((u) => u.uid === uid));
if (orphans.length) {
  console.log(`\n/users profiles with no Auth account (${orphans.length}):`);
  for (const uid of orphans) {
    const p = profiles.get(uid);
    const owned = await ownedCounts(uid);
    console.log(
      `  ${uid}  name=${p.employeeName || p.name || "—"}  role=${p.role ?? "—"}` +
        `  subscribers=${owned.subscribers}  payments=${owned.payments}`
    );
  }
  console.log("  These cannot be signed into — no Auth identity exists for them.");
}

// ── mutate ──────────────────────────────────────────────────────────────────
const target = disableEmail ?? enableEmail;
if (!target) {
  console.log("\nReport only. Pass --disable <email> to revoke an account's access.");
  process.exit(0);
}

const user = users.find((u) => u.email === target);
if (!user) {
  console.error(`\nNo Auth account for ${target}.`);
  process.exit(1);
}

const disabled = Boolean(disableEmail);
await auth.updateUser(user.uid, { disabled });
// Revoke live sessions too — updateUser alone leaves an already-issued ID token
// valid until it expires, which is up to an hour of continued access.
if (disabled) await auth.revokeRefreshTokens(user.uid);

if (profiles.has(user.uid)) {
  await db.collection("users").doc(user.uid).update({
    isActive: !disabled,
    ...(disabled ? { deactivatedAt: new Date().toISOString() } : { deactivatedAt: null }),
  });
}

console.log(`\n${disabled ? "Disabled" : "Enabled"} ${target} (${user.uid}).`);
