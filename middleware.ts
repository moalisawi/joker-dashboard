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

  // For page routes: require the __session auth-indicator cookie.
  //
  // This cookie is set (httpOnly, Secure, SameSite=Lax) by the /api/sessions/log
  // and /api/bootstrap-user route handlers immediately after a valid Firebase ID
  // token is verified server-side. It is cleared by /api/sessions/[uid]/logout.
  //
  // We only check for the cookie's *presence* here — no crypto needed — because:
  //  • The cookie is httpOnly, so client JS cannot forge it.
  //  • firebase-admin does not run on the Edge runtime; full verifySessionCookie
  //    happens in each API route handler via verifyServerUser().
  //  • Page content (rendered HTML) is not sensitive; the real guard is the API
  //    layer. This edge check fast-fails bots and unauthenticated crawlers.
  const sessionCookie = request.cookies.get("__session")?.value;
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files handled above
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
