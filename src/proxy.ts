import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 renamed Middleware to Proxy (same runtime behavior, now on
 * Node.js rather than Edge — see AGENTS.md). This is an optimistic check
 * only: it reads the session from the request, no DB round-trip, and just
 * redirects unauthenticated visitors to sign-in. It is not the app's only
 * line of defense — routes/queries should still verify server-side.
 */
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
