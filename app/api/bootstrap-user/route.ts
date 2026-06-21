import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initializeAdminApp } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 3 bootstrap attempts per IP per minute
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`bootstrap:${ip}`, 3, 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    initializeAdminApp();
    const decoded = await getAuth().verifyIdToken(token);

    // ── Allowed-domain check ───────────────────────────────────────────────────
    // Set ALLOWED_EMAIL_DOMAINS=company.com,partner.com in your environment to
    // restrict self-registration to specific email domains. When the env var is
    // absent the check is skipped so existing deployments are backward compatible.
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS;
    if (allowedDomains) {
      const domains = allowedDomains
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const emailDomain = (decoded.email ?? "").split("@")[1]?.toLowerCase();
      if (!emailDomain || !domains.includes(emailDomain)) {
        return NextResponse.json(
          { success: false, error: "Email domain not authorized" },
          { status: 403 }
        );
      }
    }

    // Auth indicator cookie — set as early as possible in the login flow so the
    // middleware guard picks it up before sessions/log is called.
    const isSecure = process.env.NODE_ENV === "production";
    const cookieOptions = [
      "__session=1",
      "Path=/",
      `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
      "HttpOnly",
      "SameSite=Lax",
      ...(isSecure ? ["Secure"] : []),
    ].join("; ");

    // User-doc provisioning needs Admin SDK (rules require role=='owner' to write).
    // Skip rather than hang ~10s on missing credentials in dev — the user can
    // be provisioned manually from the console.
    if (!hasAdminCredentials()) {
      const res = NextResponse.json(
        { success: false, skipped: true, reason: "admin-credentials-unavailable" },
        { status: 202 }
      );
      res.headers.append("Set-Cookie", cookieOptions);
      return res;
    }

    const ref = getFirestore().collection("users").doc(decoded.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        email: decoded.email || "",
        name: decoded.name || decoded.email || "",
        employeeName: "",
        role: "employee",
        status: "pending",
        active: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const res = NextResponse.json({ success: true });
    res.headers.append("Set-Cookie", cookieOptions);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bootstrap-user] failed:", message);
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
