import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { requireRole } from "@/lib/requireRole";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * The uids that still have a Firebase Auth account.
 *
 * Deleting a user in the Firebase console removes the Auth identity but leaves
 * the `/users` document behind, and the directory was rendering those leftovers
 * as staff. Only the server can tell the difference — the client SDK cannot
 * enumerate Auth — and no field on the document is a reliable stand-in: some
 * real profiles carry no `email`, others no `createdAt`.
 *
 * Returns `uids: null` rather than an error when Admin credentials are absent,
 * so the caller can tell "nobody is missing" apart from "cannot check" and
 * fail open. Hiding a real administrator is worse than showing a stale row.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`auth-uids:${ip}`, 20, 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  // Same bar as reading the directory itself: staff-level, matching the
  // `match /users` read rule. This exposes no more than /users already does.
  const result = await requireRole(request, "admin");
  if (result instanceof NextResponse) return result;

  if (!hasAdminCredentials()) {
    return NextResponse.json({ success: true, uids: null, reason: "admin-credentials-unavailable" });
  }

  try {
    const uids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await getAuth().listUsers(1000, pageToken);
      for (const u of page.users) uids.push(u.uid);
      pageToken = page.pageToken;
    } while (pageToken);

    return NextResponse.json({ success: true, uids });
  } catch {
    return NextResponse.json({ success: true, uids: null, reason: "lookup-failed" });
  }
}
