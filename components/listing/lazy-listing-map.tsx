"use client";

import dynamic from "next/dynamic";

/**
 * Code-splits the Google Maps bundle (@vis.gl/react-google-maps) out of the
 * listing page's initial JS — it only loads when the map scrolls into use.
 */
const ListingMap = dynamic(
  () => import("./listing-map").then((m) => m.ListingMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-64 w-full place-items-center rounded-xl bg-secondary/50 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export function LazyListingMap(props: { lat: number; lng: number; apiKey?: string }) {
  return <ListingMap {...props} />;
}
