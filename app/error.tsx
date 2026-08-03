"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reportError, newErrorRef } from "@/lib/observability/report";

const IS_DEV = process.env.NODE_ENV !== "production";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  // Prefer Next's server-logged digest; fall back to a fresh reference.
  const ref = useMemo(() => error.digest ?? newErrorRef(), [error]);

  useEffect(() => {
    // Logs server-side (and via any wired reporter) with the reference, route
    // and the real error — the user only ever sees the reference.
    reportError(error, { ref, route: pathname, digest: error.digest });
  }, [error, ref, pathname]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-5xl font-extrabold text-ink">Well, that&apos;s embarrassing</div>
      <p className="mt-4 text-muted-foreground">
        Something broke on our end, not yours. We&apos;ve been notified. Try again, or head back to the directory.
      </p>
      <p className="mt-3 text-xs text-faint">
        Reference: <span className="font-mono font-semibold text-muted-foreground">{ref}</span>
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-xl bg-indigo px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo/90">
          Try again
        </button>
        <Link href="/" className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:bg-secondary">
          Back to directory
        </Link>
      </div>

      {IS_DEV ? (
        <pre className="mt-8 max-w-full overflow-auto rounded-lg border border-danger/30 bg-danger-soft/40 p-4 text-left text-xs text-ink">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
      ) : null}
    </div>
  );
}
