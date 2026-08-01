"use client";

import { X } from "lucide-react";
import { useDirectoryFilters } from "./filter-context";
import type { FilterData } from "@/lib/directory/types";

const ESA_LABELS: Record<string, string> = {
  yes: "Accepts ESA",
  no: "No ESA",
  unsure: "ESA: Not sure",
};

export function ActiveFilterChips({
  filterData,
}: {
  filterData: FilterData;
}) {
  const { filters, setParams } = useDirectoryFilters();

  const tagNameBySlug = new Map<string, string>();
  for (const group of filterData.groups) {
    for (const tag of group.tags) tagNameBySlug.set(tag.slug, tag.name);
  }
  const categoryName = filterData.categories.find(
    (c) => c.slug === filters.category,
  )?.name;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.q)
    chips.push({
      key: "q",
      label: `"${filters.q}"`,
      onRemove: () => setParams((p) => p.delete("q")),
    });
  if (filters.category)
    chips.push({
      key: "category",
      label: categoryName ?? filters.category,
      onRemove: () =>
        setParams((p) => {
          p.delete("category");
          p.delete("tags");
        }),
    });
  if (filters.city)
    chips.push({
      key: "city",
      label: filters.city,
      onRemove: () => setParams((p) => p.delete("city")),
    });
  if (filters.esa)
    chips.push({
      key: "esa",
      label: ESA_LABELS[filters.esa],
      onRemove: () => setParams((p) => p.delete("esa")),
    });
  if (filters.bbox)
    chips.push({
      key: "bbox",
      label: "Map area",
      onRemove: () => setParams((p) => p.delete("bbox")),
    });
  for (const slug of filters.tags)
    chips.push({
      key: `tag:${slug}`,
      label: tagNameBySlug.get(slug) ?? slug,
      onRemove: () =>
        setParams((p) => {
          const next = filters.tags.filter((s) => s !== slug);
          if (next.length) p.set("tags", next.join(","));
          else p.delete("tags");
        }),
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet/30 bg-violet-soft px-3 py-1 text-xs font-semibold text-indigo-deep transition-colors hover:border-violet"
        >
          {chip.label}
          <X className="h-3 w-3" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          setParams((p) => {
            ["q", "category", "city", "esa", "tags", "bbox"].forEach((k) =>
              p.delete(k),
            );
          })
        }
        className="text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-ink"
      >
        Clear all
      </button>
    </div>
  );
}
