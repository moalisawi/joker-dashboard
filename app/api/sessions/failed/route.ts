import { NextResponse }           from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireRole }             from "@/lib/requireRole";
import { initializeAdminApp }      from "@/lib/serverAuth";

export const runtime = "nodejs";

// ── UA mini-parser (reused from log route) ────────────────────────────────────

function parseUAMinimal(ua: string) {
  let browser = "Unknown";
  let os      = "Unknown";
  let device  = "desktop";

  if (/iPad/i.test(ua))            { device = "tablet"; os = "iOS"; }
  else if (/iPhone|iPod/i.test(ua)){ device = "mobile"; os = "iOS"; }
  else if (/Android/i.test(ua))    { device = /Mobile/i.test(ua) ? "mobile" : "tablet"; os = "Android"; }
  else if (/Windows/i.test(ua))    { os = "Windows"; }
  else if (/Mac OS X/i.test(ua))   { os = "macOS"; }
  else if (/Linux/i.test(ua))      { os = "Linux"; }

  if      (/Edg\//i.test(ua))    browser = "Edge";
  else if (/OPR\//i.test(ua))    browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua))browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return { browser, os, device };
}

// ── POST: log a failed login attempt (unauthenticated — from login page) ─────

export async function POST(request: Request): Promise<NextResponse> {
  initializeAdminApp();

  let body: { email?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const ua = request.headers.get("user-agent") || "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "Unknown";

  const { browser, os, device } = parseUAMinimal(ua);

  // Sanitize email — store as-is but never trust it for auth
  const safeEmail  = typeof body.email === "string"
    ? body.email.trim().toLowerCase().slice(0, 254)
    : undefined;

  const safeReason = typeof body.reason === "string"
    ? body.reason.slice(0, 100)
    : "unknown";

  try {
    await getFirestore().collection("failedLogins").add({
      email:       safeEmail,
      ipAddress:   ip,
      userAgent:   ua.slice(0, 500),
      browser,
      os,
      device,
      reason:      safeReason,
      attemptedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sessions/failed] POST:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// ── GET: return recent failed attempts (admin/owner only) ─────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  initializeAdminApp();

  const result = await requireRole(request, "admin");
  if (result instanceof NextResponse) return result;

  try {
    const snap = await getFirestore()
      .collection("failedLogins")
      .orderBy("attemptedAt", "desc")
      .limit(200)
      .get();

    const attempts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, attempts });
  } catch (err) {
    console.error("[sessions/failed] GET:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
