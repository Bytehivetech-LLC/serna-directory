"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { reportError, newErrorRef } from "@/lib/observability/report";

/**
 * Scopes a listing-page failure to ONE listing instead of looking like the whole
 * site is down. A half-finished listing (no images/coords/tags/category) should
 * render, but if something still throws, this degrades to a retry + a way back.
 */
export default function ListingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ref = useMemo(() => error.digest ?? newErrorRef(), [error]);
  useEffect(() => {
    reportError(error, { ref, scope: "listing", digest: error.digest });
  }, [error, ref]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">
        This listing couldn&rsquo;t be shown
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong loading this one. The rest of the directory is fine —
        try again, or head back to browse.
      </p>
      <p className="mt-2 text-xs text-faint">
        Reference: <span className="font-mono text-muted-foreground">{ref}</span>
      </p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-indigo px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:bg-secondary"
        >
          Back to directory
        </Link>
      </div>
    </div>
  );
}
