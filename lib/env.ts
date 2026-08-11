/**
 * Environment validation.
 *
 * This module used to parse and throw at import time, and the README described
 * it as validating the environment at startup. It did neither, because nothing
 * imported it — and it could not have, safely: `next build` imports every route
 * module to collect metadata, so a module-load throw would have failed CI, which
 * builds with no secrets on purpose. The dead code and the documentation
 * disagreed with the running system in both directions.
 *
 * So validation is now explicit and lazy. Nothing here runs unless called:
 *
 *   validateClientEnv()  → issues with the NEXT_PUBLIC_* bundle values
 *   validateServerEnv()  → issues with the secret values
 *   assertServerEnv()    → throws; call from a request path, never at module load
 *
 * Production runtime already fails clearly on absent credentials without this:
 * `hasAdminCredentials()` is false and the mutation routes answer 503. What this
 * adds is a precise account of *which* variables are missing, for a diagnostic
 * that can say so rather than leaving someone to guess — which is exactly the
 * failure mode that cost this project months (docs/CHANGELOG-2026-08-10.md).
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

/** Names of the variables that are missing or malformed. Empty means healthy. */
export function validateClientEnv(): string[] {
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

  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

/** Names of the server variables that are missing or malformed. Empty means healthy. */
export function validateServerEnv(): string[] {
  // Server secrets are not present in a browser bundle and never should be.
  if (typeof window !== "undefined") return [];

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

  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

/**
 * The variables without which the server cannot do its job at all. Upstash and
 * Resend are absent deliberately: the app degrades honestly without them (local
 * rate limiting, no email), while these three mean no data access whatsoever.
 */
const CRITICAL_SERVER_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY_B64",
];

/**
 * Throws when a critical server variable is absent.
 *
 * Call from inside a request handler. Never at module load — `next build`
 * imports route modules, and a throw there fails CI builds, which run without
 * secrets on purpose.
 */
export function assertServerEnv(): void {
  const issues = validateServerEnv().filter((issue) =>
    CRITICAL_SERVER_VARS.some((name) => issue.startsWith(name))
  );
  if (issues.length > 0) {
    throw new Error(
      `[env] Missing critical server environment variables:\n${issues.map((i) => `  • ${i}`).join("\n")}`
    );
  }
}

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
