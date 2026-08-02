"use client";

import { useEffect } from "react";
import { incrementViewAction } from "@/lib/listing/actions";

/** Fires a deduped, best-effort view ping once per mount. Renders nothing. */
export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    void incrementViewAction(listingId);
  }, [listingId]);
  return null;
}
