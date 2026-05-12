import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Role } from "@/types";
import { hasAdminCredentials, fsGet } from "@/lib/serverFirestore";

type UserDocument = {
  role?: Role;
  status?: string;
  active?: boolean;
  granularPermissions?: Record<string, Record<string, boolean>>;
};

export type VerifiedServerUser = {
  uid: string;
  email?: string;
  role: Role;
  active: boolean;
  granularPermissions?: Record<string, Record<string, boolean>>;
};

export function initializeAdminApp() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return;
  }

  initializeApp({ projectId });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function isActiveUser(data: UserDocument): boolean {
  if (data.status) return data.status === "active";
  return data.active === true;
}

export function hasServerPermission(
  user: VerifiedServerUser,
  category: string,
  action: string
): boolean {
  if (user.role === "owner" || user.role === "admin") return true;
  return user.granularPermissions?.[category]?.[action] === true;
}

export function getBearerToken(request: Request): string | null {
  return bearerToken(request);
}

export async function verifyServerUser(request: Request): Promise<VerifiedServerUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  initializeAdminApp();

  // verifyIdToken uses Google public keys — works without admin credentials
  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid   = decoded.uid;
    email = decoded.email;
  } catch {
    return null;
  }

  // Read user document — Admin SDK if credentials available, else Firestore REST API
  let data: UserDocument | null = null;

  if (hasAdminCredentials()) {
    try {
      const snap = await getFirestore().collection("users").doc(uid).get();
      if (!snap.exists) return null;
      data = snap.data() as UserDocument;
    } catch {
      return null;
    }
  } else {
    // Fallback: Firestore REST API with the user's own token
    // Rules allow: allow read if request.auth.uid == uid
    const raw = await fsGet("users", uid, token);
    if (!raw) return null;
    data = {
      role:                 raw.role                 as Role | undefined,
      status:               raw.status               as string | undefined,
      active:               raw.active               as boolean | undefined,
      granularPermissions:  raw.granularPermissions  as Record<string, Record<string, boolean>> | undefined,
    };
  }

  if (!data || !isActiveUser(data)) return null;

  return {
    uid,
    email,
    role:                data.role ?? "employee",
    active:              true,
    granularPermissions: data.granularPermissions,
  };
}
