"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useDirectoryNav } from "./use-directory-nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/** Debounced live search that writes ?q= to the directory URL. */
export function DirectorySearch({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const { setParams } = useDirectoryNav();
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const id = setTimeout(() => {
      setParams((p) => {
        const trimmed = text.trim();
        if (trimmed) p.set("q", trimmed);
        else p.delete("q");
      });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={cn("relative", className)}>
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
