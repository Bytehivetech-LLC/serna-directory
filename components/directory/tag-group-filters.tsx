"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useDirectoryNav } from "./use-directory-nav";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { DirectoryFilters, FilterData } from "@/lib/directory/types";

/** The "Filters" icon button + slide-out drawer holding the tag groups. */
export function FiltersDrawer({
  filters,
  filterData,
}: {
  filters: DirectoryFilters;
  filterData: FilterData;
}) {
  const activeCount = filterData.groups.reduce(
    (sum, g) =>
      sum + g.tags.filter((t) => filters.tags.includes(t.slug)).length,
    0,
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 ? (
            <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-indigo px-1 text-xs font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[88vw] max-w-sm overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-3 pb-8">
          {filterData.groups.length > 0 ? (
            filterData.groups.map((group) => (
              <TagGroupBlock
                key={group.id}
                group={group}
                selected={filters.tags}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional filters for this selection. Pick a category to see
              subject filters.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TagGroupBlock({
  group,
  selected,
}: {
  group: FilterData["groups"][number];
  selected: string[];
}) {
  const { setParams } = useDirectoryNav();
  const selectedCount = group.tags.filter((t) =>
    selected.includes(t.slug),
  ).length;
  const [open, setOpen] = useState(selectedCount > 0);

  return (
    <div className="rounded-xl border border-border-strong">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink"
      >
        <span>
          {group.name}
          {selectedCount > 0 ? (
            <span className="ml-2 text-xs font-semibold text-violet">
              · {selectedCount} selected
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-faint transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          {group.tags.map((tag) => {
            const checked = selected.includes(tag.slug);
            return (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-ink"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() =>
                    setParams((p) => {
                      const next = checked
                        ? selected.filter((s) => s !== tag.slug)
                        : [...selected, tag.slug];
                      if (next.length) p.set("tags", next.join(","));
                      else p.delete("tags");
                    })
                  }
                />
                {tag.name}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
