import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { requireRole } from "@/lib/requireRole";
import { initializeAdminApp } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";

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

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { success: false, error: "Admin credentials غير مفعّلة على السيرفر" },
      { status: 503 }
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

    // Instantly signal all RTDB sessions for this user to terminate.
    // Client usePresence hooks detect terminated=true and sign out immediately.
    // databaseURL is configured in the admin app init (serverAuth.ts).
    try {
      const adminDb         = getDatabase();
      const userPresenceRef = adminDb.ref(`presence/${targetUid}`);
      const presenceSnap    = await userPresenceRef.once("value");
      const presenceData    = presenceSnap.val() as Record<string, object> | null;
      if (presenceData) {
        const updates: Record<string, boolean> = {};
        Object.keys(presenceData).forEach((sessionId) => {
          updates[`${sessionId}/terminated`] = true;
          updates[`${sessionId}/online`]     = false;
        });
        await userPresenceRef.update(updates);
      }
    } catch (rtdbErr) {
      // Non-fatal — Firebase Auth token revocation already prevents re-auth
      console.warn("[sessions/revoke] RTDB update failed:", rtdbErr);
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
