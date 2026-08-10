import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Role, EmployeeRole, GranularPermissions } from "@/types";
import { hasAdminCredentials, fsGet } from "@/lib/serverFirestore";
import { effectivePermissions } from "@/lib/permissions";

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

// ── Firebase Admin initialization ────────────────────────────────────────────
// Runs once at module-import time (server startup), before any request handler.
// All API route files import this module, so this executes before any request.
function _initFirebaseAdmin() {
  if (getApps().length) return;

  const projectId   = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const keyB64      = process.env.FIREBASE_PRIVATE_KEY_B64;
  const privateKey  = keyB64
    ? Buffer.from(keyB64, "base64").toString("utf8")
    : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ??
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
    (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId, databaseURL });
  } else {
    initializeApp({ projectId, databaseURL });
  }
}

_initFirebaseAdmin();

/** No-op kept for backward compatibility — initialization is now at module level. */
export function initializeAdminApp() { /* already initialized above */ }

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  // Only the owner role gets unconditional access.
  // Admins are subject to their configured granular permissions so that
  // per-admin restrictions (e.g. no refunds) are actually enforced.
  if (user.role === "owner") return true;
  // effectivePermissions applies ROLE_CEILING and falls back to the job preset,
  // then role defaults, for accounts predating granular permissions. Reading
  // user.granularPermissions directly let a job preset grant past the role —
  // a sales employee could delete subscribers and refund payments.
  const gp = effectivePermissions({
    role: user.role,
    employeeRole: (user as { employeeRole?: EmployeeRole | null }).employeeRole,
    // The document type models this loosely (it is whatever Firestore holds);
    // effectivePermissions reads it defensively and clamps it either way.
    granularPermissions: user.granularPermissions as unknown as GranularPermissions | undefined,
  }) as unknown as Record<string, Record<string, boolean>>;
  return gp?.[category]?.[action] === true;
}

export function getBearerToken(request: Request): string | null {
  return bearerToken(request);
}

export async function verifyServerUser(request: Request): Promise<VerifiedServerUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid   = decoded.uid;
    email = decoded.email;
  } catch {
    return null;
  }

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
