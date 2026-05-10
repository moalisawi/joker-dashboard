import { initializeApp, getApps, getApp } from "firebase/app";

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

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
