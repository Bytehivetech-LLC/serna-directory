"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for the review queue. If anything in the page
 * throws during render (a shape ListingView won't accept, a null relation on a
 * half-complete listing), the reviewer gets a retry instead of a raw 500.
 */
export default function ReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[review-queue] render error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-violet-soft text-violet">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-xl font-bold text-ink">
          This listing couldn&rsquo;t be shown
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The review page hit an error rendering this item. Retry to load it
          again, or open it in the full editor where each field is shown on its
          own.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/admin/listings?status=pending_review">All pending</Link>
        </Button>
      </div>
    </div>
  );
}
