import { NextResponse }           from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, initializeAdminApp } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
): Promise<NextResponse> {
  initializeAdminApp();

  // Rate limit: 2 heartbeats per IP per minute (sent every 30s by client)
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`heartbeat:${ip}`, 2, 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const user = await verifyServerUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Heartbeat writes to loginSessions via Admin SDK (rules deny client writes).
  // Without credentials in dev, the write would hang ~10s before timing out.
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

    // Only update own session and only if still active
    if (!snap.exists) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const data = snap.data()!;
    if (data.uid !== user.uid) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!(data.status === "active" || data.isActive)) return NextResponse.json({ success: true }); // no-op for closed sessions

    // Reset TTL on each heartbeat — keeps active sessions alive
    const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
    await ref.update({
      lastSeenAt: FieldValue.serverTimestamp(),
      expiresAt:  new Date(Date.now() + SESSION_TTL_MS),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sessions/heartbeat]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
