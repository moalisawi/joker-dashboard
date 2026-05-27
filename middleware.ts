import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that are publicly accessible without authentication
const PUBLIC_PATHS = new Set(["/login", "/pitch", "/api/sessions/failed"]);

// Paths that bypass the middleware entirely (static assets, Next internals)
const BYPASS_PREFIXES = ["/_next/", "/favicon.ico", "/fonts/", "/images/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass static assets
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public routes need no auth check
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // For API routes: require an Authorization header.
  // The actual token verification happens in each route handler via verifyServerUser().
  // This middleware acts as a fast-fail to reject obviously unauthenticated API calls
  // before they reach the handler and execute any business logic.
  if (pathname.startsWith("/api/")) {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // For page routes: check for the Firebase Auth session cookie or a session token.
  // Firebase Auth uses __session cookie when configured with a custom domain.
  // Without a cookie-based session, we fall back to checking for the presence of
  // local storage auth state — which is only possible client-side.
  // Therefore, we rely on the client-side ProtectedLayout guard for page auth,
  // but we can still block obviously unauthenticated requests early.
  //
  // Note: Full server-side page protection requires Firebase session cookies
  // (firebase-admin verifySessionCookie). This is the recommended upgrade path.
  const sessionCookie = request.cookies.get("__session")?.value;
  if (!sessionCookie) {
    // No session cookie: let the client-side guard handle the redirect.
    // The page will show a loading state and redirect to /login if unauthenticated.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files handled above
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
