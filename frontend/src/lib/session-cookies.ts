import { NextRequest, NextResponse } from "next/server";

import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS, SESSION_COOKIE_NAME } from "@/lib/constants";

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

// Shared by /api/auth/login and /api/auth/activate — the only two routes
// allowed to see a raw token pair, so this is the only place that mints the
// httpOnly session cookies middleware.ts checks for.
export function setSessionCookies(response: NextResponse, request: NextRequest, tokens: TokenPair): void {
  const isSecure = request.nextUrl.protocol === "https:";

  response.cookies.set(SESSION_COOKIE_NAME, tokens.access_token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, tokens.refresh_token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}
