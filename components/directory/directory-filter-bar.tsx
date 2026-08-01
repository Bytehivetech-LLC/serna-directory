"use client";

import { LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { useDirectoryNav } from "./use-directory-nav";
import { DirectorySearch } from "./directory-search";
import { FiltersDrawer } from "./tag-group-filters";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DirectoryFilters, FilterData } from "@/lib/directory/types";

const ALL = "__all__";
const NEAR_ME = "__near__";

export function DirectoryFilterBar({
  filters,
  filterData,
}: {
  filters: DirectoryFilters;
  filterData: FilterData;
}) {
  const { setParams } = useDirectoryNav();
  const esaActive = filters.esa === "yes";

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <DirectorySearch
          value={filters.q ?? ""}
          className="lg:min-w-[220px] lg:flex-1"
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <Select
            value={filters.category ?? ALL}
            onValueChange={(value) =>
              setParams((p) => {
                if (value === ALL) p.delete("category");
                else p.set("category", value);
                p.delete("tags"); // category scopes the tag groups
              })
            }
          >
            <SelectTrigger aria-label="Category" className="w-[150px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {filterData.categories.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* City */}
          <Select
            value={filters.city ?? ALL}
            onValueChange={(value) => {
              if (value === NEAR_ME) {
                requestNearMe(setParams);
                return;
              }
              setParams((p) => {
                if (value === ALL) p.delete("city");
                else p.set("city", value);
                p.delete("bbox");
              });
            }}
          >
            <SelectTrigger aria-label="City" className="w-[140px]">
              <SelectValue placeholder="Any city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any city</SelectItem>
              <SelectItem value={NEAR_ME}>
                <span className="flex items-center gap-2">
                  <LocateFixed className="h-3.5 w-3.5" /> Near me
                </span>
              </SelectItem>
              {filterData.cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ESA — single toggle */}
          <Button
            variant={esaActive ? "default" : "outline"}
            aria-pressed={esaActive}
            onClick={() =>
              setParams((p) => {
                if (esaActive) p.delete("esa");
                else p.set("esa", "yes");
              })
            }
            className={cn(!esaActive && "text-muted-foreground")}
          >
            ESA Eligible
          </Button>

          <FiltersDrawer filters={filters} filterData={filterData} />
        </div>
      </div>
    </div>
  );
}

function requestNearMe(
  setParams: ReturnType<typeof useDirectoryNav>["setParams"],
) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    toast.error("Your browser can't share your location.");
    return;
  }
  toast.loading("Finding listings near you…", { id: "near-me" });
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const d = 0.25; // ~15 miles
      const bbox = [longitude - d, latitude - d, longitude + d, latitude + d];
      toast.success("Showing this area", { id: "near-me" });
      setParams((p) => {
        p.set("bbox", bbox.join(","));
        p.delete("city");
      });
    },
    () => toast.error("We couldn't get your location.", { id: "near-me" }),
    { enableHighAccuracy: false, timeout: 8000 },
  );
}
