/**
 * Centralized, validated environment configuration.
 *
 * Import this module (not process.env directly) everywhere you need env vars.
 * The Zod parse runs once at module load time and throws immediately if any
 * required variable is absent, so misconfigured deployments fail at startup
 * rather than at runtime inside a request handler.
 *
 * Client vs. server distinction:
 *  - clientEnv  → NEXT_PUBLIC_* vars, safe to expose in the browser bundle
 *  - serverEnv  → secret vars, only accessed in API routes / server components
 *
 * Usage:
 *   import { clientEnv, serverEnv } from "@/lib/env";
 */

import { z } from "zod";

// ─── Client-side environment ──────────────────────────────────────────────────
// These are bundled into the browser. Never put secrets here.

const clientSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY:            z.string().min(1, "Firebase API key is required"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:        z.string().min(1, "Firebase auth domain is required"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:         z.string().min(1, "Firebase project ID is required"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:     z.string().min(1, "Firebase storage bucket is required"),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:z.string().min(1, "Firebase messaging sender ID is required"),
  NEXT_PUBLIC_FIREBASE_APP_ID:             z.string().min(1, "Firebase app ID is required"),
  NEXT_PUBLIC_FIREBASE_DATABASE_URL:       z.string().url("Firebase database URL must be a valid URL").optional(),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:     z.string().optional(),
});

// ─── Server-side environment ──────────────────────────────────────────────────
// Never import this from client components. Next.js will error if you try.

const serverSchema = z.object({
  // Firebase Admin SDK
  FIREBASE_PROJECT_ID:    z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL:  z.string().email("FIREBASE_CLIENT_EMAIL must be a valid email"),
  // Accept either base64-encoded key (preferred) or raw PEM key with escaped newlines
  FIREBASE_PRIVATE_KEY_B64: z.string().optional(),
  FIREBASE_PRIVATE_KEY:     z.string().optional(),
  FIREBASE_DATABASE_URL:  z.string().url("FIREBASE_DATABASE_URL must be a valid URL").optional(),

  // Email — Resend
  RESEND_API_KEY:     z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL:  z.string().min(1, "RESEND_FROM_EMAIL is required"),

  // Rate limiting — Upstash Redis (optional; falls back to in-memory if absent)
  UPSTASH_REDIS_REST_URL:   z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
}).refine(
  (d) => d.FIREBASE_PRIVATE_KEY_B64 || d.FIREBASE_PRIVATE_KEY,
  { message: "Either FIREBASE_PRIVATE_KEY_B64 or FIREBASE_PRIVATE_KEY must be set", path: ["FIREBASE_PRIVATE_KEY_B64"] }
);

// ─── Parse & export ───────────────────────────────────────────────────────────

function parseClientEnv() {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL:        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`[env] Missing or invalid client environment variables:\n${issues}`);
  }
  return result.data;
}

function parseServerEnv() {
  // Skip server-side validation in browser bundles
  if (typeof window !== "undefined") return null;

  const result = serverSchema.safeParse({
    FIREBASE_PROJECT_ID:      process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL:    process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY_B64: process.env.FIREBASE_PRIVATE_KEY_B64,
    FIREBASE_PRIVATE_KEY:     process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_DATABASE_URL:    process.env.FIREBASE_DATABASE_URL,
    RESEND_API_KEY:            process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL:         process.env.RESEND_FROM_EMAIL,
    UPSTASH_REDIS_REST_URL:    process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN:  process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    // Log but don't crash — some env vars are optional in dev (e.g. Upstash)
    const criticalPaths = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY_B64"];
    const hasCritical = result.error.issues.some((i) => criticalPaths.includes(String(i.path[0])));
    if (hasCritical) {
      throw new Error(`[env] Missing critical server environment variables:\n${issues}`);
    }
    console.warn(`[env] Non-critical server env warnings:\n${issues}`);
  }

  return result.success ? result.data : (result as unknown as { data: z.infer<typeof serverSchema> }).data;
}

export const clientEnv = parseClientEnv();

export const serverEnv = parseServerEnv();

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Returns the Firebase Admin private key as a PEM string, regardless of how it was supplied. */
export function getFirebasePrivateKey(): string {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (raw) return raw.replace(/\\n/g, "\n");
  throw new Error("[env] No Firebase private key configured");
}

/** True when Upstash Redis is configured for distributed rate limiting. */
export function hasUpstashRedis(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
