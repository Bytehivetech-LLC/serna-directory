"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Mutate the directory filter query string. Changing a filter resets to page 1
 * unless `resetPage: false` (used by pagination). Navigation is scroll-preserving
 * so the map and scroll position stay put.
 */
export function useDirectoryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      opts?: { resetPage?: boolean },
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      if (opts?.resetPage !== false) params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { setParams };
}
