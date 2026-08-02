"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportError } from "@/lib/observability/report";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-5xl font-extrabold text-ink">Well, that&apos;s embarrassing</div>
      <p className="mt-4 text-muted-foreground">
        Something broke on our end, not yours. We&apos;ve been notified. Try again, or head back to the directory.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-xl bg-indigo px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo/90">
          Try again
        </button>
        <Link href="/" className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:bg-secondary">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
