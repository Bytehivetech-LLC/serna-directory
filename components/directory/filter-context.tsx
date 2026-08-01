"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseFilters } from "@/lib/directory/filters";
import type { DirectoryFilters } from "@/lib/directory/types";

const DEBOUNCE_MS = 350;

type SetParamsOpts = { resetPage?: boolean; debounce?: boolean };

type FilterContextValue = {
  /** Live (optimistic) filters — reflect control changes instantly. */
  filters: DirectoryFilters;
  /** True while an AJAX navigation to apply filters is in flight. */
  isPending: boolean;
  setParams: (
    mutate: (params: URLSearchParams) => void,
    opts?: SetParamsOpts,
  ) => void;
};

const FilterContext = createContext<FilterContextValue | null>(null);

function paramsToRecord(params: URLSearchParams): Record<string, string> {
  const record: Record<string, string> = {};
  params.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

/**
 * Holds an optimistic mirror of the filter query string. Controls update it
 * instantly (snappy UI) while the actual URL push — which re-runs the Server
 * Component and refreshes results via AJAX — is debounced so rapid changes
 * (typing, ticking several boxes) collapse into one request.
 */
export function DirectoryFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [paramsStr, setParamsStr] = useState(() => searchParams.toString());
  const paramsRef = useRef(paramsStr);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the optimistic state in sync with the real URL (nav, back/forward).
  useEffect(() => {
    const next = searchParams.toString();
    paramsRef.current = next;
    setParamsStr(next);
  }, [searchParams]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const push = useCallback(
    (next: string) => {
      startTransition(() => {
        router.push(next ? `${pathname}?${next}` : pathname, {
          scroll: false,
        });
      });
    },
    [router, pathname],
  );

  const setParams = useCallback<FilterContextValue["setParams"]>(
    (mutate, opts = {}) => {
      const params = new URLSearchParams(paramsRef.current);
      mutate(params);
      if (opts.resetPage !== false) params.delete("page");

      const next = params.toString();
      paramsRef.current = next;
      setParamsStr(next);

      if (timer.current) clearTimeout(timer.current);
      if (opts.debounce) {
        timer.current = setTimeout(() => push(next), DEBOUNCE_MS);
      } else {
        push(next);
      }
    },
    [push],
  );

  const filters = useMemo(
    () => parseFilters(paramsToRecord(new URLSearchParams(paramsStr))),
    [paramsStr],
  );

  const value = useMemo(
    () => ({ filters, isPending, setParams }),
    [filters, isPending, setParams],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useDirectoryFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error(
      "useDirectoryFilters must be used within a DirectoryFilterProvider",
    );
  }
  return ctx;
}
