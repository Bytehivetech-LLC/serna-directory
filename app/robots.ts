import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/**
 * The admin deployment disallows everything (no admin surface should be crawled
 * or indexed). The public deployment allows crawling and points at the sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (process.env.APP_TARGET === "admin") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const SITE = await getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/api/"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
