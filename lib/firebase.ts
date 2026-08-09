import * as firebaseApp from "firebase/app";

// Fallback values allow `next build` to succeed without Firebase credentials,
// which CI needs — it builds with no secrets. Set the real NEXT_PUBLIC_FIREBASE_*
// values in .env.local for dev and in the Vercel project for production.
//
// NEXT_PUBLIC_* variables are inlined at build time, so a build that ran without
// them bakes these placeholders into the browser bundle permanently. That is not
// a hypothetical: it shipped to production once and every login failed with
// `auth/api-key-not-valid`, which the login page did not recognise and reported
// as a generic "unexpected error". The guard below turns that silent failure
// into a loud one — see PLACEHOLDER_API_KEY.
const PLACEHOLDER_API_KEY = "AIzaSyBuildPlaceholderKeyForCI0000000000";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? PLACEHOLDER_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "build-placeholder.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "build-placeholder",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "build-placeholder.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:000000000000:web:0000000000000000",
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL       ?? "",
};

// Namespace import (not destructured named imports) — the firebase/app wrapper
// re-exports via Object.defineProperty getters that webpack can't statically
// analyze for named imports, so reading them off the namespace object at
// runtime is the reliable path on both CJS and ESM resolutions.
export const app = firebaseApp.getApps().length
  ? firebaseApp.getApp()
  : firebaseApp.initializeApp(firebaseConfig);

/**
 * True when the browser bundle was built without Firebase credentials.
 *
 * Nothing that talks to Firebase can work in this state — every call fails with
 * `auth/api-key-not-valid`. Callers surface it as a configuration problem
 * instead of letting it masquerade as a bad password. Checked in the browser
 * only: a server render during CI legitimately has no client config.
 */
export const isFirebaseMisconfigured =
  typeof window !== "undefined" && firebaseConfig.apiKey === PLACEHOLDER_API_KEY;

if (isFirebaseMisconfigured) {
  console.error(
    "[firebase] This build has no NEXT_PUBLIC_FIREBASE_* configuration — it is " +
      "running on CI placeholders, so sign-in and all data access will fail. " +
      "Set the variables in the hosting project and redeploy; they are inlined " +
      "at build time, so setting them without a rebuild changes nothing."
  );
}

// ─── App Check ────────────────────────────────────────────────────────────────
//
// The web API key is public by design — it ships in the browser bundle. Without
// App Check, anyone holding it can talk to Firestore directly from outside the
// app, and the only thing standing in the way is firestore.rules. App Check adds
// a second question: is this request coming from the real app at all?
//
// Activation is driven entirely by NEXT_PUBLIC_RECAPTCHA_SITE_KEY:
//   • unset  → no-op, exactly as before (local dev, CI builds, previews)
//   • set    → attestation runs on every Firebase request
//
// Order of operations matters. Register the app and turn the key on here FIRST,
// leave the Firebase console in *monitoring* mode for a few days to confirm
// traffic is attested, and only then switch the console to enforcement.
// Enforcing before clients send tokens locks the app out of its own data.
//
// For local development, set NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=true to have the
// SDK print a debug token you can register in the console.
if (typeof window !== "undefined") {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    void (async () => {
      try {
        const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");

        const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
        if (debugToken) {
          (window as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
            debugToken === "true" ? true : debugToken;
        }

        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (err) {
        // Never let attestation setup break app start-up: if this throws, the
        // app still works and Firestore rules remain the guard.
        console.error("[firebase] App Check init failed:", err);
      }
    })();
  }
}
