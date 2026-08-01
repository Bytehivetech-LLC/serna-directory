"use client";

import { useState } from "react";
import { Map as MapIcon, Search } from "lucide-react";
import { useDirectoryFilters } from "./filter-context";
import { DirectoryFilterBar } from "./directory-filter-bar";
import { ListingTile } from "./listing-tile";
import { ActiveFilterChips } from "./active-filter-chips";
import { DirectoryPagination } from "./directory-pagination";
import { DirectoryMap } from "./directory-map";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import type {
  DirectoryListing,
  FilterData,
  MapSettings,
} from "@/lib/directory/types";

export function DirectoryView({
  listings,
  total,
  page,
  pageCount,
  filterData,
  mapSettings,
}: {
  listings: DirectoryListing[];
  total: number;
  page: number;
  pageCount: number;
  filterData: FilterData;
  mapSettings: MapSettings;
}) {
  const { isPending, setParams } = useDirectoryFilters();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const clearAll = () =>
    setParams((p) =>
      ["q", "category", "city", "esa", "tags", "bbox"].forEach((k) =>
        p.delete(k),
      ),
    );

  return (
    <div className="space-y-5">
      <DirectoryFilterBar filterData={filterData} />

      <div className="lg:grid lg:grid-cols-[58fr_42fr] lg:gap-6">
        {/* Left column: results */}
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-ink">{total}</span>{" "}
              {total === 1 ? "listing" : "listings"}
            </p>
          </div>

          <ActiveFilterChips filterData={filterData} />

          {/* Results dim slightly while a filter request is in flight. */}
          <div
            className={cn(
              "transition-opacity duration-200",
              isPending && "pointer-events-none opacity-50",
            )}
            aria-busy={isPending}
          >
            {listings.length > 0 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {listings.map((listing) => (
                    <ListingTile
                      key={listing.id}
                      listing={listing}
                      active={hoveredId === listing.id}
                      onHover={setHoveredId}
                    />
                  ))}
                </div>
                <DirectoryPagination page={page} pageCount={pageCount} />
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="No listings match your filters"
                description="Try removing a filter or widening your search — fewer tags, a nearby city, or clear everything and start over."
                action={
                  <Button variant="outline" onClick={clearAll}>
                    Clear all filters
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {/* Desktop sticky map */}
        <div className="hidden lg:block">
          <div className="sticky top-4 h-[calc(100vh-6rem)]">
            <DirectoryMap
              listings={listings}
              settings={mapSettings}
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          </div>
        </div>
      </div>

      {/* Mobile floating Map pill → full-screen map */}
      <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="rounded-full px-5 shadow-lg">
              <MapIcon className="h-4 w-4" />
              Map
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[88vh] p-3">
            <SheetHeader className="sr-only">
              <SheetTitle>Map of listings</SheetTitle>
            </SheetHeader>
            <div className="h-full pt-2">
              <DirectoryMap
                listings={listings}
                settings={mapSettings}
                hoveredId={hoveredId}
                onHover={setHoveredId}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
