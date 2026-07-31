import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/constants";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "host",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "cookie", // the session cookie is server-only — never forwarded downstream
]);

function backendBaseUrl(): string {
  return process.env.API_PROXY_TARGET ?? "http://localhost:8090";
}

function filterRequestHeaders(headers: Headers): Headers {
  const filtered = new Headers();
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      filtered.append(key, value);
    }
  });
  return filtered;
}

function filterResponseHeaders(headers: Headers): Headers {
  const filtered = new Headers();
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      filtered.append(key, value);
    }
  });
  return filtered;
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const targetUrl = `${backendBaseUrl()}/api/v1/${path.join("/")}${request.nextUrl.search}`;
  const hasBody = !["GET", "HEAD"].includes(request.method);

  const headers = filterRequestHeaders(request.headers);
  const accessToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: filterResponseHeaders(backendResponse.headers),
  });
}

type RouteParams = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { path } = await params;
  return proxy(request, path ?? []);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
