import { NextResponse }           from "next/server";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { verifyServerUser, initializeAdminApp } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
): Promise<NextResponse> {
  initializeAdminApp();

  // Rate limit: 10 logout requests per IP per minute
  const ip = getClientIp(request);
  if (!checkRateLimit(`session-logout:${ip}`, 10, 60 * 1000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const user = await verifyServerUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Session logout writes via Admin SDK (rules deny client writes).
  // Without credentials in dev, skip rather than block logout flow on a 10s timeout.
  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { success: false, skipped: true, reason: "admin-credentials-unavailable" },
      { status: 202 }
    );
  }

  const { uid: sessionId } = await params;
  if (!sessionId) return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });

  try {
    const ref  = getFirestore().collection("loginSessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ success: true }); // already gone

    const data = snap.data()!;
    if (data.uid !== user.uid) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    // Calculate duration
    const loginMs    = (data.loginAt as Timestamp)?.toMillis?.() ?? 0;
    const durationSec = loginMs > 0 ? Math.floor((Date.now() - loginMs) / 1000) : null;

    await ref.update({
      status:          "logged_out",
      isActive:        false,
      logoutAt:        FieldValue.serverTimestamp(),
      sessionDuration: durationSec,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sessions/logout]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
