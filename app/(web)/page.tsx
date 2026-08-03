import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { DirectoryView } from "@/components/directory/directory-view";
import { DirectoryFilterProvider } from "@/components/directory/filter-context";
import { parseFilters, filtersToQueryString } from "@/lib/directory/filters";
import {
  fetchDirectory,
  fetchFilterData,
  fetchMapSettings,
} from "@/lib/directory/queries";
import { getSettings } from "@/lib/settings";

type SearchParamsPromise = Promise<
  Record<string, string | string[] | undefined>
>;

function prettify(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}): Promise<Metadata> {
  const filters = parseFilters(await searchParams);

  const bits: string[] = [];
  if (filters.category) bits.push(prettify(filters.category));
  if (filters.city) bits.push(`in ${filters.city}`);
  if (filters.esa === "yes") bits.push("accepting ESA");

  const title = bits.length
    ? `Arizona ${bits.join(" ")} — Directory`
    : "Arizona Homeschool & Education Directory";

  const description = bits.length
    ? `Browse ${bits.join(" ")} for Arizona homeschool families — filter by city, ages, subjects, and ESA acceptance.`
    : "Find Arizona homeschool tutors, co-ops, micro-schools, and enrichment programs. Filter by city, ages, subjects, and ESA acceptance.";

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const canonical = `${base}/${filtersToQueryString(filters)}`;

  return { title, description, alternates: { canonical } };
}

export default async function DirectoryHomePage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const filters = parseFilters(await searchParams);

  const [result, filterData, mapSettings, settings] = await Promise.all([
    fetchDirectory(filters),
    fetchFilterData(filters.category),
    fetchMapSettings(),
    // Read the SAME keys the branding form writes (hero_heading/hero_subheading).
    // The page previously read hero_title/hero_subtitle, which nothing wrote —
    // that key mismatch is why the hero never appeared while the footer did.
    getSettings(["hero_heading", "hero_subheading"]),
  ]);

  const heroTitle =
    typeof settings.hero_heading === "string" ? settings.hero_heading.trim() : "";
  const heroSubtitle =
    typeof settings.hero_subheading === "string" ? settings.hero_subheading.trim() : "";
  const showHero = Boolean(heroTitle || heroSubtitle);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: result.listings.slice(0, 24).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${base}/listing/${l.slug}`,
      name: l.businessName,
    })),
  };

  return (
    <PageContainer className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {/* Hero sits above the filter bar + grid; hidden entirely when both values
          are empty so we never leave a blank band. */}
      {showHero ? (
        <div className="mb-6 max-w-2xl">
          {heroTitle ? (
            <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.015em] text-ink sm:text-4xl">
              {heroTitle}
            </h1>
          ) : null}
          {heroSubtitle ? (
            <p className="mt-3 text-base text-muted-foreground">{heroSubtitle}</p>
          ) : null}
        </div>
      ) : null}

      <DirectoryFilterProvider>
        <DirectoryView
          listings={result.listings}
          total={result.total}
          page={result.page}
          pageCount={result.pageCount}
          filterData={filterData}
          mapSettings={mapSettings}
        />
      </DirectoryFilterProvider>
    </PageContainer>
  );
}
