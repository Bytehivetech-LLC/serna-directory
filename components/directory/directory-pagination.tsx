"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDirectoryFilters } from "./filter-context";
import { Button } from "@/components/ui/button";

export function DirectoryPagination({
  page,
  pageCount,
}: {
  page: number;
  pageCount: number;
}) {
  const { setParams } = useDirectoryFilters();
  if (pageCount <= 1) return null;

  const goTo = (target: number) =>
    setParams(
      (p) => {
        if (target <= 1) p.delete("page");
        else p.set("page", String(target));
      },
      { resetPage: false },
    );

  return (
    <nav
      className="flex items-center justify-between gap-4 pt-2"
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page <span className="font-semibold text-ink">{page}</span> of{" "}
        {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => goTo(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
