import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = new Set([
  "https://droply-izuwan.izuwanmarketing.chatgpt.site",
  "https://droply.izuwanautomobile.com",
  "http://localhost:3002",
]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return new NextResponse(null, { status: 403 });
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }
  const response = NextResponse.next();
  if (allowedOrigins.has(origin)) {
    for (const [name, value] of Object.entries(corsHeaders(origin))) response.headers.set(name, value);
  }
  return response;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export const config = { matcher: ["/api/media", "/api/download"] };
