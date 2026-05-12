import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initializeAdminApp } from "@/lib/serverAuth";

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

  try {
    initializeAdminApp();
    const decoded = await getAuth().verifyIdToken(token);
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
