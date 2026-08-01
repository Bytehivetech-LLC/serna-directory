import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { DirectoryView } from "@/components/directory/directory-view";
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
    getSettings(["hero_title", "hero_subtitle"]),
  ]);

  const heroTitle =
    typeof settings.hero_title === "string" && settings.hero_title
      ? settings.hero_title
      : "Find the right fit for your family";
  const heroSubtitle =
    typeof settings.hero_subtitle === "string" && settings.hero_subtitle
      ? settings.hero_subtitle
      : "Tutors, co-ops, micro schools and more across Arizona.";

  return (
    <PageContainer className="max-w-[1280px] py-8">
      <div className="mb-6 max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.015em] text-ink sm:text-4xl">
          {heroTitle}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{heroSubtitle}</p>
      </div>

      <DirectoryView
        listings={result.listings}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        filters={filters}
        filterData={filterData}
        mapSettings={mapSettings}
      />
    </PageContainer>
  );
}
