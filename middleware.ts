import { NextResponse, type NextRequest } from "next/server";

/**
 * One repo, two deployments. APP_TARGET decides which surface this instance
 * serves:
 *   - "web"   -> public site + owner dashboard; /admin/* is hard-404'd
 *   - "admin" -> the staff console only; everything outside /admin is 404'd,
 *                and "/" redirects to "/admin"
 * Defaults to "web" when unset (e.g. local dev without the env var).
 */
const APP_TARGET = process.env.APP_TARGET === "admin" ? "admin" : "web";

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (APP_TARGET === "web") {
    if (isAdminPath(pathname)) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next();
  }

  // APP_TARGET === "admin"
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  if (!isAdminPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
