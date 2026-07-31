import { NextRequest, NextResponse } from "next/server";

import { ROUTES, SESSION_COOKIE_NAME } from "@/lib/constants";

export const config = {
  matcher: ["/app", "/app/:path*", "/login"],
};

// Gate-keeps by cookie presence only — never decodes/trusts the JWT itself
// (see dev.md's React Middleware section). The Go backend re-validates the
// token on every proxied request regardless of what this check decides.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const isProtectedRoute = pathname === ROUTES.app || pathname.startsWith(`${ROUTES.app}/`);

  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === ROUTES.login && hasSessionCookie) {
    return NextResponse.redirect(new URL(ROUTES.app, request.url));
  }

  return NextResponse.next();
}
