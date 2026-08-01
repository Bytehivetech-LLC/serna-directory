import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * One repo, two deployments (APP_TARGET). This middleware:
 *   1. refreshes the Supabase session on every request,
 *   2. enforces the web/admin surface split (hard 404 for the wrong surface),
 *   3. sends unauthenticated admin visitors to /login,
 *   4. sets security headers + a locked-down CSP on every response.
 */
const APP_TARGET = process.env.APP_TARGET === "admin" ? "admin" : "web";
const IS_DEV = process.env.NODE_ENV !== "production";

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** On the admin deployment, only these surfaces resolve. */
function isAdminSurfaceAllowed(pathname: string): boolean {
  return (
    isAdminPath(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/") || // email confirmation / password reset callback
    pathname.startsWith("/api/")
  );
}

function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'", // Next.js inline bootstrap; no nonce pipeline yet
      ...(IS_DEV ? ["'unsafe-eval'"] : []), // React Refresh in dev
      "https://js.stripe.com",
      "https://maps.googleapis.com",
      "https://www.google.com",
      "https://www.gstatic.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"], // Tailwind + injected theme <style>
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://*.supabase.co",
      "https://*.googleapis.com",
      "https://*.gstatic.com",
      "https://*.ggpht.com",
      "https://*.google.com",
      "https://q.stripe.com",
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://maps.googleapis.com",
      "https://api.stripe.com",
      "https://www.google.com",
    ],
    "frame-src": [
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://www.google.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=()",
  );
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return response;
}

/** Copy any refreshed auth cookies onto a response we're returning instead. */
function withCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

function notFound(from: NextResponse): NextResponse {
  return withCookies(from, new NextResponse("Not found", { status: 404 }));
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (APP_TARGET === "web") {
    if (isAdminPath(pathname)) {
      return applySecurityHeaders(notFound(response));
    }
    return applySecurityHeaders(response);
  }

  // APP_TARGET === "admin"
  if (pathname === "/") {
    return applySecurityHeaders(
      withCookies(response, NextResponse.redirect(new URL("/admin", request.url))),
    );
  }
  if (!isAdminSurfaceAllowed(pathname)) {
    return applySecurityHeaders(notFound(response));
  }
  if (isAdminPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return applySecurityHeaders(
      withCookies(response, NextResponse.redirect(loginUrl)),
    );
  }
  return applySecurityHeaders(response);
}

export const config = {
  // Run on everything except Next internals and static assets, so the session
  // refresh and headers apply to every real navigation and API call.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
