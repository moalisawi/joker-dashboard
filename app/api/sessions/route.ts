import { NextResponse }           from "next/server";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { requireRole }             from "@/lib/requireRole";
import { initializeAdminApp }      from "@/lib/serverAuth";
import { hasAdminCredentials }     from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

function tsToMs(val: unknown): number {
  if (!val) return 0;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === "object" && val !== null) {
    if ("toMillis" in val) return (val as Timestamp).toMillis();
    if ("seconds" in val) return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function todayStartMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function GET(request: Request): Promise<NextResponse> {
  initializeAdminApp();

  // Rate limit: 30 session list requests per IP per minute
  const ip = getClientIp(request);
  if (!checkRateLimit(`sessions-list:${ip}`, 30, 60 * 1000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const result = await requireRole(request, "admin");
  if (result instanceof NextResponse) return result;

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { success: true, sessions: [], summary: { totalActive: 0, onlineNow: 0, todayLogins: 0, failedToday: 0 }, skipped: true, reason: "admin-credentials-unavailable" },
      { status: 200 }
    );
  }

  try {
    const fiveMinAgoMs = Date.now() - 5 * 60 * 1000;
    const todayMs      = todayStartMs();

    // Fetch sessions ordered newest first; single-field index (auto-created)
    const sessionsSnap = await getFirestore()
      .collection("loginSessions")
      .orderBy("loginAt", "desc")
      .limit(500)
      .get();

    // Fetch today's failed logins count
    const failedSnap = await getFirestore()
      .collection("failedLogins")
      .where("attemptedAt", ">=", Timestamp.fromMillis(todayMs))
      .get();

    const sessions = sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Compute summary from fetched dataset
    const summary = {
      totalActive: sessions.filter((s: Record<string, unknown>) =>
        s.status === "active" || s.isActive === true
      ).length,

      onlineNow: sessions.filter((s: Record<string, unknown>) => {
        if (!(s.status === "active" || s.isActive === true)) return false;
        return tsToMs(s.lastSeenAt) >= fiveMinAgoMs;
      }).length,

      todayLogins: sessions.filter((s: Record<string, unknown>) =>
        tsToMs(s.loginAt) >= todayMs
      ).length,

      failedToday: failedSnap.size,
    };

    return NextResponse.json({ success: true, sessions, summary });
  } catch (err) {
    console.error("[sessions] GET:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
