import { NextRequest, NextResponse } from "next/server";

import { setSessionCookies } from "@/lib/session-cookies";

interface BackendTokenPair {
  access_token: string;
  refresh_token: string;
}

interface BackendEnvelope {
  success: boolean;
  message: string;
  data?: BackendTokenPair;
  error_code?: string;
}

function backendBaseUrl(): string {
  return process.env.API_PROXY_TARGET ?? "http://localhost:8090";
}

// POST /api/auth/login is intentionally NOT proxied through the generic
// catch-all proxy route — it's the one place allowed to read the raw token
// pair so it can mint the httpOnly session cookies middleware.ts checks for.
export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendResponse = await fetch(`${backendBaseUrl()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const envelope: BackendEnvelope = await backendResponse.json();

  if (!backendResponse.ok || !envelope.data) {
    return NextResponse.json(
      { success: false, message: envelope.message, error_code: envelope.error_code },
      { status: backendResponse.status },
    );
  }

  const response = NextResponse.json({ success: true, message: envelope.message });
  setSessionCookies(response, request, envelope.data);
  return response;
}
