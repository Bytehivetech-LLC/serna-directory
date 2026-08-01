"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LocateFixed, Search } from "lucide-react";
import { toast } from "sonner";
import { useDirectoryNav } from "./use-directory-nav";
import type { DirectoryFilters, FilterData } from "@/lib/directory/types";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const NEAR_ME = "__near__";
const ESA_OPTIONS: { value: "yes" | "no" | "unsure"; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

export function FilterControls({
  filters,
  filterData,
}: {
  filters: DirectoryFilters;
  filterData: FilterData;
}) {
  const { setParams } = useDirectoryNav();

  return (
    <div className="space-y-5">
      <SearchBox value={filters.q ?? ""} />

      <Field label="Category">
        <Select
          value={filters.category ?? ALL}
          onValueChange={(value) =>
            setParams((p) => {
              if (value === ALL) p.delete("category");
              else p.set("category", value);
              // Category scopes the tag groups; drop tags so none go stale.
              p.delete("tags");
            })
          }
        >
          <SelectTrigger aria-label="Category">
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
      </Field>

      <Field label="City">
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
          <SelectTrigger aria-label="City">
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
      </Field>

      <Field label="Accepts Arizona ESA funds">
        <div className="flex flex-wrap gap-2">
          {ESA_OPTIONS.map((opt) => {
            const active = filters.esa === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setParams((p) => {
                    if (active) p.delete("esa");
                    else p.set("esa", opt.value);
                  })
                }
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-indigo bg-indigo text-white"
                    : "border-border-strong bg-card text-muted-foreground hover:border-violet",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      {filterData.groups.map((group) => (
        <TagGroupBlock
          key={group.id}
          group={group}
          selected={filters.tags}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.06em] text-faint">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SearchBox({ value }: { value: string }) {
  const { setParams } = useDirectoryNav();
  const [text, setText] = useState(value);

  // Keep in sync when filters change elsewhere (e.g. Clear all).
  useEffect(() => setText(value), [value]);

  // Debounce writes to the URL.
  useEffect(() => {
    if (text === value) return;
    const id = setTimeout(() => {
      setParams((p) => {
        if (text.trim()) p.set("q", text.trim());
        else p.delete("q");
      });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search business or keyword"
        aria-label="Search the directory"
        className="pl-9"
      />
    </div>
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
  const selectedCount = group.tags.filter((t) => selected.includes(t.slug)).length;
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
    () => {
      toast.error("We couldn't get your location.", { id: "near-me" });
    },
    { enableHighAccuracy: false, timeout: 8000 },
  );
}
