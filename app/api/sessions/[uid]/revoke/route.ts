import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireRole } from "@/lib/requireRole";
import { initializeAdminApp } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
): Promise<NextResponse> {
  initializeAdminApp();

  const result = await requireRole(request, "admin");
  if (result instanceof NextResponse) return result;

  const { user } = result;
  const { uid: targetUid } = await params;

  if (!targetUid) {
    return NextResponse.json({ success: false, error: "Missing uid" }, { status: 400 });
  }

  if (targetUid === user.uid) {
    return NextResponse.json(
      { success: false, error: "لا يمكنك إلغاء جلستك الحالية" },
      { status: 400 }
    );
  }

  try {
    // Revoke all Firebase Auth refresh tokens — user must re-login after token expiry
    await getAuth().revokeRefreshTokens(targetUid);

    // Mark all active Firestore session records as revoked
    const sessionsSnap = await getFirestore()
      .collection("loginSessions")
      .where("uid", "==", targetUid)
      .where("isActive", "==", true)
      .get();

    if (!sessionsSnap.empty) {
      const batch = getFirestore().batch();
      sessionsSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status:    "logged_out",
          isActive:  false,
          revokedAt: FieldValue.serverTimestamp(),
          revokedBy: user.uid,
        });
      });
      await batch.commit();
    }

    // Audit log
    await getFirestore().collection("auditLogs").add({
      action: "session_force_logout",
      category: "security",
      severity: "warning",
      source: "server",
      entityType: "user",
      entityId: targetUid,
      description: `Force logout: all sessions revoked for ${targetUid}`,
      performedBy: { uid: user.uid, email: user.email || "", role: user.role },
      actorUid: user.uid,
      actorName: user.email || user.uid,
      actorRole: user.role,
      targetType: "user",
      targetId: targetUid,
      summary: "Force logout — all sessions and tokens revoked",
      tags: ["security", "session", "force-logout"],
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sessions/revoke] failed:", message);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
