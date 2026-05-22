/**
 * seed-whatsapp.ts
 *
 * One-off script that seeds Firestore with realistic WhatsApp lead and message
 * data derived from the mock data files. Run ONCE per environment.
 *
 * Prerequisites:
 *   1. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local
 *      OR use Application Default Credentials (firebase login --reauth / gcloud auth).
 *   2. npm run seed:whatsapp
 *
 * Each seeded document gets seedData: true so you can identify and bulk-delete
 * them later:
 *   db.collection("whatsappLeads").where("seedData", "==", true).get()  → delete all
 *
 * Safe to run multiple times — duplicate phones are skipped via a phone-uniqueness check.
 */

// Load .env.local before anything else. Use dynamic import so tsc doesn't
// complain if dotenv isn't in dependencies — tsx resolves it at runtime.
// If dotenv isn't installed, the script still works with env vars set externally.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv") as { config: (opts: { path: string }) => void };
  dotenv.config({ path: ".env.local" });
} catch {
  // dotenv not available — rely on process.env being pre-populated
}

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

// ── Init admin ────────────────────────────────────────────────────────────────

if (!getApps().length) {
  const projectId    = process.env.FIREBASE_PROJECT_ID    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    // Fall back to Application Default Credentials (local firebase emulator or gcloud login)
    initializeApp({ projectId });
  }
}

const db = getFirestore();

// ── Import mock data ──────────────────────────────────────────────────────────
// We import the compiled mock data at runtime via tsx (transpiles TS on the fly)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MOCK_LEADS }            = require("../features/whatsapp-leads/mock/leads.mock");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MOCK_MESSAGES }         = require("../features/whatsapp-leads/mock/messages.mock");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MOCK_CANNED_RESPONSES } = require("../features/whatsapp-leads/mock/cannedResponses.mock");

// ── Helpers ───────────────────────────────────────────────────────────────────

function toAdminTimestamp(t: unknown): FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp {
  if (t && typeof t === "object" && "toDate" in t && typeof (t as { toDate: () => Date }).toDate === "function") {
    const d = (t as { toDate: () => Date }).toDate();
    return Timestamp.fromDate(d);
  }
  return FieldValue.serverTimestamp();
}

// ── Seed leads ────────────────────────────────────────────────────────────────

async function seedLeads(): Promise<Map<string, string>> {
  const leadsCol    = db.collection("whatsappLeads");
  const idMap       = new Map<string, string>(); // mockId → firestoreId
  let   created     = 0;
  let   skipped     = 0;

  for (const lead of MOCK_LEADS) {
    // Check for existing doc with same phone (skip duplicates)
    const existing = await leadsCol
      .where("phone",    "==", lead.phone)
      .where("seedData", "==", true)
      .limit(1)
      .get();

    if (!existing.empty) {
      idMap.set(lead.id, existing.docs[0].id);
      skipped++;
      continue;
    }

    const ref = leadsCol.doc();
    const { id: _mockId, ...rest } = lead;

    await ref.set({
      ...rest,
      deleted:            rest.deleted ?? false,
      conversationStatus: rest.conversationStatus ?? "مفتوحة",
      unreadCount:        rest.unreadCount        ?? 0,
      notes:              (rest.notes ?? []).map((n: Record<string, unknown>) => ({
        ...n,
        createdAt: toAdminTimestamp(n.createdAt),
      })),
      tags:               rest.tags ?? [],
      firstMessageAt:     toAdminTimestamp(rest.firstMessageAt),
      lastMessageAt:      toAdminTimestamp(rest.lastMessageAt),
      createdAt:          toAdminTimestamp(rest.createdAt),
      updatedAt:          toAdminTimestamp(rest.updatedAt),
      seedData:           true,
    });

    idMap.set(lead.id, ref.id);
    created++;
    process.stdout.write(`  ✓ lead [${lead.id}] → ${ref.id}\n`);
  }

  console.log(`\nLeads: ${created} created, ${skipped} skipped (duplicate phone)\n`);
  return idMap;
}

// ── Seed messages ─────────────────────────────────────────────────────────────

async function seedMessages(leadIdMap: Map<string, string>): Promise<void> {
  const col     = db.collection("whatsappMessages");
  let   created = 0;
  let   skipped = 0;

  for (const msg of MOCK_MESSAGES) {
    const firestoreLeadId = leadIdMap.get(msg.leadId);
    if (!firestoreLeadId) {
      skipped++;
      continue;
    }

    // Check for existing seed message to avoid duplicates on re-run
    const existing = await col
      .where("leadId",   "==", firestoreLeadId)
      .where("seedData", "==", true)
      .where("body",     "==", msg.body)
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped++;
      continue;
    }

    const { id: _mockId, timestamp, ...rest } = msg;
    await col.add({
      ...rest,
      leadId:    firestoreLeadId,
      timestamp: toAdminTimestamp(timestamp),
      deleted:   rest.deleted ?? false,
      seedData:  true,
    });
    created++;
  }

  console.log(`Messages: ${created} created, ${skipped} skipped\n`);
}

// ── Seed canned responses ─────────────────────────────────────────────────────

async function seedCannedResponses(): Promise<void> {
  const col     = db.collection("cannedResponses");
  let   created = 0;
  let   skipped = 0;

  for (const cr of MOCK_CANNED_RESPONSES) {
    const existing = await col
      .where("seedData", "==", true)
      .where("title",    "==", cr.title)
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped++;
      continue;
    }

    const { id: _mockId, createdAt, ...rest } = cr;
    await col.add({
      ...rest,
      createdAt: toAdminTimestamp(createdAt),
      deleted:   false,
      seedData:  true,
    });
    created++;
  }

  console.log(`Canned responses: ${created} created, ${skipped} skipped\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== WhatsApp Seed Script ===\n");
  console.log("Seeding leads...");
  const leadIdMap = await seedLeads();
  console.log("Seeding messages...");
  await seedMessages(leadIdMap);
  console.log("Seeding canned responses...");
  await seedCannedResponses();
  console.log("=== Seed complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
