"use client";

import { useEffect, useRef } from "react";
import { markInquiriesReadAction } from "@/lib/dashboard/actions";

/** Marks the listing's new inquiries as read on open. Renders nothing. */
export function MarkInquiriesRead({ listingId }: { listingId: string }) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void markInquiriesReadAction(listingId);
  }, [listingId]);
  return null;
}
