import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { EsaAnswer } from "@/types";
import { DEFAULT_PER_PAGE } from "./filters";
import type {
  DirectoryFilters,
  DirectoryListing,
  FilterData,
  FilterTagGroup,
  MapSettings,
  SearchListingRow,
} from "./types";

const IMAGE_BUCKET = "listing-images";

export type DirectoryResult = {
  listings: DirectoryListing[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

/** Run the directory query (search_listings RPC) and shape rows for tiles/map. */
export async function fetchDirectory(
  filters: DirectoryFilters,
): Promise<DirectoryResult> {
  const supabase = await createClient();

  const settings = await getSettings(["listings_per_page"]);
  const perPage =
    typeof settings.listings_per_page === "number" &&
    settings.listings_per_page > 0
      ? settings.listings_per_page
      : DEFAULT_PER_PAGE;

  const offset = (filters.page - 1) * perPage;

  const { data, error } = await supabase.rpc("search_listings", {
    p_query: filters.q ?? undefined,
    p_category: filters.category ?? undefined,
    p_city: filters.city ?? undefined,
    p_tag_slugs: filters.tags.length ? filters.tags : undefined,
    p_esa: filters.esa ?? undefined,
    p_bbox: filters.bbox ?? undefined,
    p_limit: perPage,
    p_offset: offset,
  });

  if (error || !data) {
    return { listings: [], total: 0, page: filters.page, perPage, pageCount: 0 };
  }

  const rows = data as unknown as SearchListingRow[];
  const total = rows[0]?.total_count ?? 0;

  // ESA isn't in the RPC output — look it up for the returned ids (badge only).
  const ids = rows.map((r) => r.id);
  const esaById = new Map<string, EsaAnswer | null>();
  if (ids.length) {
    const { data: esaRows } = await supabase
      .from("listings")
      .select("id, accepts_esa")
      .in("id", ids);
    for (const r of esaRows ?? []) esaById.set(r.id, r.accepts_esa);
  }

  const listings: DirectoryListing[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    businessName: r.business_name,
    city: r.city,
    categoryName: r.category_name,
    categorySlug: r.category_slug,
    coverUrl: r.cover_path
      ? supabase.storage.from(IMAGE_BUCKET).getPublicUrl(r.cover_path).data
          .publicUrl
      : null,
    isFeatured: r.is_featured,
    acceptsEsa: esaById.get(r.id) ?? null,
    lat: r.latitude,
    lng: r.longitude,
  }));

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  return { listings, total, page: filters.page, perPage, pageCount };
}

/** Categories, distinct cities, and the tag groups relevant to the selection. */
export async function fetchFilterData(
  selectedCategorySlug?: string,
): Promise<FilterData> {
  const supabase = await createClient();

  const [categoriesRes, groupsRes, tagsRes, citiesRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("tag_groups")
      .select("id, name, slug, category_id, sort_order")
      .eq("show_in_filter", true)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("tags")
      .select("id, group_id, name, slug")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("listings")
      .select("city")
      .eq("status", "published")
      .not("city", "is", null),
  ]);

  const categories = (categoriesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const cities = Array.from(
    new Set(
      (citiesRes.data ?? [])
        .map((r) => (r.city ?? "").trim())
        .filter((c): c is string => c.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const selectedCategory = categories.find(
    (c) => c.slug === selectedCategorySlug,
  );

  const tagsByGroup = new Map<
    string,
    { id: string; name: string; slug: string }[]
  >();
  for (const t of tagsRes.data ?? []) {
    const list = tagsByGroup.get(t.group_id) ?? [];
    list.push({ id: t.id, name: t.name, slug: t.slug });
    tagsByGroup.set(t.group_id, list);
  }

  // Data-driven: global groups (category_id null) plus groups scoped to the
  // selected category. Adding a group in the admin makes it appear here.
  const groups: FilterTagGroup[] = (groupsRes.data ?? [])
    .filter(
      (g) =>
        g.category_id === null ||
        (selectedCategory != null && g.category_id === selectedCategory.id),
    )
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      categoryId: g.category_id,
      tags: (tagsByGroup.get(g.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }))
    .filter((g) => g.tags.length > 0);

  return { categories, cities, groups };
}

export async function fetchMapSettings(): Promise<MapSettings> {
  const settings = await getSettings(["default_map_center"]);
  const center = settings.default_map_center as
    | { lat?: number; lng?: number; zoom?: number }
    | undefined;
  return {
    lat: typeof center?.lat === "number" ? center.lat : 33.4255,
    lng: typeof center?.lng === "number" ? center.lng : -111.94,
    zoom: typeof center?.zoom === "number" ? center.zoom : 10,
  };
}
