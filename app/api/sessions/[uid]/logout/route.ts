import { NextResponse }           from "next/server";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { verifyServerUser, initializeAdminApp } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
): Promise<NextResponse> {
  initializeAdminApp();

  const user = await verifyServerUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
    const durationSec = loginMs ? Math.floor((Date.now() - loginMs) / 1000) : undefined;

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
