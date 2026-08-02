import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/** Home, categories, cities, and every published listing. Admin host emits nothing. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.APP_TARGET === "admin") return [];

  const SITE = await getSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/list-a-program`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  try {
    const supabase = await createClient();
    const [{ data: categories }, { data: listings }] = await Promise.all([
      supabase.from("categories").select("slug").eq("is_active", true),
      supabase
        .from("listings")
        .select("slug, city, updated_at")
        .eq("status", "published")
        .is("deleted_at", null)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false })
        .limit(5000),
    ]);

    for (const c of categories ?? []) {
      entries.push({ url: `${SITE}/?category=${encodeURIComponent(c.slug)}`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }

    const cities = new Set(
      (listings ?? []).map((l) => (l.city ?? "").trim()).filter(Boolean),
    );
    for (const city of cities) {
      entries.push({ url: `${SITE}/?city=${encodeURIComponent(city)}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    }

    for (const l of listings ?? []) {
      if (!l.slug) continue;
      entries.push({ url: `${SITE}/listing/${l.slug}`, lastModified: l.updated_at ? new Date(l.updated_at) : now, changeFrequency: "weekly", priority: 0.8 });
    }
  } catch {
    /* a DB hiccup shouldn't 500 the sitemap — return what we have */
  }

  return entries;
}
