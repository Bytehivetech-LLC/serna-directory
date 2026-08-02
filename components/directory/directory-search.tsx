"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useDirectoryFilters } from "./filter-context";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/** Live search box. Writes ?q= via the debounced context. */
export function DirectorySearch({ className }: { className?: string }) {
  const { filters, setParams } = useDirectoryFilters();
  const [text, setText] = useState(filters.q ?? "");

  // Sync only on external changes (e.g. Clear all) — not while typing.
  useEffect(() => {
    if ((filters.q ?? "") !== text.trim()) setText(filters.q ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          setParams(
            (p) => {
              const trimmed = value.trim();
              if (trimmed) p.set("q", trimmed);
              else p.delete("q");
            },
            { debounce: true },
          );
        }}
        placeholder="Search business or keyword"
        aria-label="Search the directory"
        className="pl-9"
      />
    </div>
  );
}
