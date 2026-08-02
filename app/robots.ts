import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://directory.sernaeducationalservices.com";

/**
 * The admin deployment disallows everything (no admin surface should be crawled
 * or indexed). The public deployment allows crawling and points at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_TARGET === "admin") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/api/"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
