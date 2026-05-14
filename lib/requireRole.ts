import { NextResponse }  from "next/server";
import { verifyServerUser } from "@/lib/serverAuth";
import type { VerifiedServerUser } from "@/lib/serverAuth";
import type { Role } from "@/types";

type RoleResult =
  | { user: VerifiedServerUser }
  | NextResponse;

const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, employee: 1 };

/**
 * Server-side role guard for API route handlers.
 *
 * Returns `{ user }` when the caller's role is >= `minRole`.
 * Returns a `NextResponse` error otherwise.
 *
 * ```ts
 * const result = await requireRole(request, "admin");
 * if (result instanceof NextResponse) return result;
 * const { user } = result;
 * ```
 */
export async function requireRole(
  request: Request,
  minRole: Role
): Promise<RoleResult> {
  let user: VerifiedServerUser | null;
  try {
    user = await verifyServerUser(request);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    return NextResponse.json({ success: false, error: "Forbidden: insufficient role" }, { status: 403 });
  }

  return { user };
}

/**
 * Strict owner-only guard. Use for irreversible or highly sensitive operations.
 */
export async function requireOwner(request: Request): Promise<RoleResult> {
  return requireRole(request, "owner");
}
