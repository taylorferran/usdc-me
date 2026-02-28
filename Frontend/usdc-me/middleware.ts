import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin route protection ───────────────────────────────────────────
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = request.cookies.get("admin_session")?.value
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword || session !== adminPassword) {
      const loginUrl = new URL("/admin/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── CORS for API routes ──────────────────────────────────────────────
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  const response = NextResponse.next()
  if (pathname.startsWith("/api/")) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value)
    }
  }
  return response
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
}
