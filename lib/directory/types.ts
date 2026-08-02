import type { EsaAnswer } from "@/types";

/** Raw row returned by the public.search_listings RPC. */
export type SearchListingRow = {
  id: string;
  slug: string;
  business_name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  category_name: string | null;
  category_slug: string | null;
  cover_path: string | null;
  is_featured: boolean;
  completeness: number | null;
  /** Window count of all matches (same on every row). */
  total_count: number;
};

/** Tile-ready listing (serializable, passed to client components). */
export type DirectoryListing = {
  id: string;
  slug: string;
  businessName: string;
  city: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  coverUrl: string | null;
  isFeatured: boolean;
  acceptsEsa: EsaAnswer | null;
  lat: number | null;
  lng: number | null;
};

export type EsaFilter = "yes" | "no" | "unsure";

/** All directory filters — the entire shareable state, mirrored in the URL. */
export type DirectoryFilters = {
  q?: string;
  category?: string; // category slug
  city?: string;
  esa?: EsaFilter;
  tags: string[]; // tag slugs
  /** Map "search this area" box: [west, south, east, north] (lng/lat). */
  bbox?: [number, number, number, number];
  page: number; // 1-based
};

export type CategoryOption = { id: string; name: string; slug: string };

export type FilterTagGroup = {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  tags: { id: string; name: string; slug: string }[];
};

export type FilterData = {
  categories: CategoryOption[];
  cities: string[];
  groups: FilterTagGroup[];
};

export type MapSettings = {
  lat: number;
  lng: number;
  zoom: number;
  /** Browser Maps key from site_settings (falls back to the env var client-side). */
  apiKey?: string;
};
