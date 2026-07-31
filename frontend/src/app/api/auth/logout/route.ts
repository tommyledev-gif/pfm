import { NextRequest, NextResponse } from "next/server";

import { REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/constants";

function backendBaseUrl(): string {
  return process.env.API_PROXY_TARGET ?? "http://localhost:8090";
}

// POST /api/auth/logout revokes the refresh token on the backend, then
// clears both session cookies regardless of the backend call's outcome —
// the browser session must end even if the revoke call itself fails.
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    await fetch(`${backendBaseUrl()}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ success: true, message: "logged out" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}
