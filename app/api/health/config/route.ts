import { NextResponse } from "next/server";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { requireRole } from "@/lib/requireRole";

export const runtime = "nodejs";
// Never cached: the whole point is to report the deployment's live state, and a
// cached "healthy" from before an env change is worse than no check at all.
export const dynamic = "force-dynamic";

/**
 * Is this deployment actually able to do its job?
 *
 * This exists because the answer has twice been "no" while every screen looked
 * fine. `docs/` records a placeholder Firebase key that broke every production
 * login for three months; on 14 Aug 2026 the production deployment turned out
 * to be missing FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY_B64, so every
 * write — new subscriber, payment, renewal, user management — had been
 * answering 503 while reads worked normally and nothing announced it.
 *
 * The shape of that failure is what makes it dangerous: reads work, so the app
 * looks healthy, and the break only surfaces at the moment someone tries to
 * save. A deployment that cannot write should say so on arrival, not on the
 * first attempt to record money.
 *
 * Reports **booleans only**. No value, no prefix, no length — a health endpoint
 * that leaks the shape of a private key is a worse problem than the one it
 * diagnoses. Gated to staff for the same reason: the set of things a server is
 * missing is a map for anyone probing it.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const result = await requireRole(request, "admin");
  if (result instanceof NextResponse) return result;

  const adminSdk = hasAdminCredentials();

  const checks = {
    /** Admin SDK — required by every write path in the app. */
    adminCredentials: adminSdk,
    projectId: Boolean(process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    clientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY_B64 || process.env.FIREBASE_PRIVATE_KEY),
    publicApiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    storageBucket: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  };

  const missing = Object.entries(checks)
    .filter(([key, ok]) => !ok && key !== "adminCredentials")
    .map(([key]) => key);

  return NextResponse.json({
    success: true,
    /** false ⇒ the deployment can read but cannot write anything. */
    canWrite: adminSdk,
    checks,
    missing,
    message: adminSdk
      ? "الخادم مهيَّأ بالكامل"
      : "بيانات اعتماد الخادم (Admin SDK) غير مضبوطة — كل عمليات الحفظ معطّلة",
  });
}
