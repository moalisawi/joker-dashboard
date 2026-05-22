import * as firebaseApp from "firebase/app";

// Fallback values allow the build to succeed without Firebase credentials.
// Set real NEXT_PUBLIC_FIREBASE_* values in .env.local for dev/production.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "AIzaSyBuildPlaceholderKeyForCI0000000000",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "build-placeholder.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "build-placeholder",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "build-placeholder.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:000000000000:web:0000000000000000",
};

// Namespace import (not destructured named imports) — the firebase/app wrapper
// re-exports via Object.defineProperty getters that webpack can't statically
// analyze for named imports, so reading them off the namespace object at
// runtime is the reliable path on both CJS and ESM resolutions.
export const app = firebaseApp.getApps().length
  ? firebaseApp.getApp()
  : firebaseApp.initializeApp(firebaseConfig);
