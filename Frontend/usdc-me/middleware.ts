import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
}

export function middleware(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  // Add CORS headers to API responses
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: "/api/:path*",
}
