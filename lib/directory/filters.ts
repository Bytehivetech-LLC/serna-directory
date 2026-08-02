import type { DirectoryFilters, EsaFilter } from "./types";

export const DEFAULT_PER_PAGE = 24;

const ESA_VALUES: EsaFilter[] = ["yes", "no", "unsure"];

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

/** Parse Next's searchParams object into typed, validated filters. */
export function parseFilters(sp: RawSearchParams): DirectoryFilters {
  const q = first(sp.q);
  const category = first(sp.category);
  const city = first(sp.city);

  const esaRaw = first(sp.esa);
  const esa = esaRaw && ESA_VALUES.includes(esaRaw as EsaFilter)
    ? (esaRaw as EsaFilter)
    : undefined;

  const tagsRaw = first(sp.tags);
  const tags = tagsRaw
    ? Array.from(new Set(tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)))
    : [];

  let bbox: DirectoryFilters["bbox"];
  const bboxRaw = first(sp.bbox);
  if (bboxRaw) {
    const parts = bboxRaw.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      bbox = [parts[0], parts[1], parts[2], parts[3]];
    }
  }

  const pageRaw = Number(first(sp.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return { q, category, city, esa, tags, bbox, page };
}

/** Serialise filters back into a URLSearchParams (omitting empties/defaults). */
export function filtersToSearchParams(filters: DirectoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.esa) params.set("esa", filters.esa);
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  if (filters.bbox) params.set("bbox", filters.bbox.join(","));
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function filtersToQueryString(filters: DirectoryFilters): string {
  const s = filtersToSearchParams(filters).toString();
  return s ? `?${s}` : "";
}

/** True when any user-facing filter is active (ignores page/bbox). */
export function hasActiveFilters(filters: DirectoryFilters): boolean {
  return Boolean(
    filters.q || filters.category || filters.city || filters.esa || filters.tags.length,
  );
}
