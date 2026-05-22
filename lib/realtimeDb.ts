import { getDatabase, type Database } from "firebase/database";
import { app } from "./firebase";

// RTDB is optional — it requires NEXT_PUBLIC_FIREBASE_DATABASE_URL to be set.
// When the env var is absent (local dev without RTDB), all hooks degrade gracefully.
function tryGetDatabase(): Database | null {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!url) return null;
  try {
    return getDatabase(app);
  } catch {
    return null;
  }
}

export const rtdb: Database | null = tryGetDatabase();
export const rtdbAvailable = rtdb !== null;
