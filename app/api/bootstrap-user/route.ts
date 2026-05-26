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

    // User-doc provisioning needs Admin SDK (rules require role=='owner' to write).
    // Skip rather than hang ~10s on missing credentials in dev — the user can
    // be provisioned manually from the console.
    if (!hasAdminCredentials()) {
      return NextResponse.json(
        { success: false, skipped: true, reason: "admin-credentials-unavailable" },
        { status: 202 }
      );
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

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bootstrap-user] failed:", message);
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
