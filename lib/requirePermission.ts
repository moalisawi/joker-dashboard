import { NextResponse }  from "next/server";
import { verifyServerUser, hasServerPermission } from "@/lib/serverAuth";
import type { VerifiedServerUser } from "@/lib/serverAuth";

type PermResult =
  | { user: VerifiedServerUser }
  | NextResponse;

/**
 * Server-side permission guard for API route handlers.
 *
 * Returns `{ user }` on success.
 * Returns a `NextResponse` error (401/403) on failure — the caller must
 * return it immediately:
 *
 * ```ts
 * const result = await requirePermission(request, "subscribers", "edit");
 * if (result instanceof NextResponse) return result;
 * const { user } = result;
 * ```
 *
 * Owners and admins always pass (role-based shortcut in hasServerPermission).
 */
export async function requirePermission(
  request: Request,
  category: string,
  action: string
): Promise<PermResult> {
  let user: VerifiedServerUser | null;
  try {
    user = await verifyServerUser(request);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServerPermission(user, category, action)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return { user };
}

/**
 * Shorthand that only checks authentication (no specific permission).
 * Use when any active employee should be allowed.
 */
export async function requireAuth(request: Request): Promise<PermResult> {
  let user: VerifiedServerUser | null;
  try {
    user = await verifyServerUser(request);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return { user };
}
