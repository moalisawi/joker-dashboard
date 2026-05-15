import { NextResponse }           from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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

    // Only update own session and only if still active
    if (!snap.exists) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const data = snap.data()!;
    if (data.uid !== user.uid) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!(data.status === "active" || data.isActive)) return NextResponse.json({ success: true }); // no-op for closed sessions

    await ref.update({ lastSeenAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sessions/heartbeat]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
