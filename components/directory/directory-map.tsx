"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { MapPinned, Star } from "lucide-react";
import { useDirectoryFilters } from "./filter-context";
import type { DirectoryListing, MapSettings } from "@/lib/directory/types";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

const MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const CLUSTER_THRESHOLD = 40;

export function DirectoryMap({
  listings,
  settings,
  hoveredId,
  onHover,
}: {
  listings: DirectoryListing[];
  settings: MapSettings;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const apiKey =
    settings.apiKey ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <MapPinned className="h-8 w-8 text-violet/50" aria-hidden />
        <p className="text-sm font-semibold text-ink">Map unavailable</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          to show listings on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-border">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId={MAP_ID}
          defaultCenter={{ lat: settings.lat, lng: settings.lng }}
          defaultZoom={settings.zoom}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="h-full w-full"
        >
          <ClusteredMarkers
            listings={listings}
            hoveredId={hoveredId}
            onHover={onHover}
          />
          <SearchThisAreaButton />
        </Map>
      </APIProvider>
    </div>
  );
}

function Pin({ featured, active }: { featured: boolean; active: boolean }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full border-2 border-white shadow-md transition-transform",
        featured ? "bg-indigo" : "bg-violet",
        active ? "h-7 w-7 scale-125" : "h-5 w-5",
      )}
    >
      {featured ? <Star className="h-3 w-3 fill-white text-white" /> : null}
    </div>
  );
}

function ClusteredMarkers({
  listings,
  hoveredId,
  onHover,
}: {
  listings: DirectoryListing[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const map = useMap();
  const router = useRouter();
  const clusterer = useRef<MarkerClusterer | null>(null);
  const markers = useRef<
    Record<string, google.maps.marker.AdvancedMarkerElement>
  >({});
  const [infoId, setInfoId] = useState<string | null>(null);

  const pinned = listings.filter((l) => l.lat != null && l.lng != null);
  // Stable key for the current set of pins — drives re-clustering.
  const pinKey = pinned.map((l) => l.id).join(",");

  useEffect(() => {
    if (!map || clusterer.current) return;
    clusterer.current = new MarkerClusterer({ map });
  }, [map]);

  // Cluster only past the threshold; below it, show individual pins. Runs after
  // commit (markers.current is populated by the marker refs) whenever the pin
  // set or map changes — NOT on every render.
  useEffect(() => {
    const c = clusterer.current;
    if (!c) return;
    c.clearMarkers();
    if (Object.keys(markers.current).length > CLUSTER_THRESHOLD) {
      c.addMarkers(Object.values(markers.current));
    }
  }, [pinKey, map]);

  // Ref callback only mutates the ref map — never sets state (that caused an
  // infinite render loop when the ref detached/reattached each render).
  const setMarkerRef = (
    marker: google.maps.marker.AdvancedMarkerElement | null,
    id: string,
  ) => {
    if (marker) markers.current[id] = marker;
    else delete markers.current[id];
  };

  const info = infoId ? pinned.find((l) => l.id === infoId) : null;

  return (
    <>
      {pinned.map((l) => (
        <AdvancedMarker
          key={l.id}
          position={{ lat: l.lat!, lng: l.lng! }}
          ref={(marker) => setMarkerRef(marker, l.id)}
          onMouseEnter={() => {
            onHover(l.id);
            setInfoId(l.id);
          }}
          onMouseLeave={() => onHover(null)}
          onClick={() => router.push(`/listing/${l.slug}`)}
          zIndex={hoveredId === l.id ? 10 : l.isFeatured ? 5 : 1}
        >
          <Pin featured={l.isFeatured} active={hoveredId === l.id} />
        </AdvancedMarker>
      ))}

      {info && info.lat != null && info.lng != null ? (
        <InfoWindow
          position={{ lat: info.lat, lng: info.lng }}
          headerDisabled
          onCloseClick={() => setInfoId(null)}
        >
          <button
            type="button"
            onClick={() => router.push(`/listing/${info.slug}`)}
            className="block w-44 text-left"
          >
            <div className="aspect-video w-full overflow-hidden rounded-md bg-gradient-to-br from-violet-soft to-secondary">
              {info.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.coverUrl}
                  alt=""
                  width={320}
                  height={180}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <p className="mt-1.5 font-display text-sm font-semibold text-ink">
              {info.businessName}
            </p>
            {info.city ? (
              <p className="text-xs text-muted-foreground">{info.city}</p>
            ) : null}
          </button>
        </InfoWindow>
      ) : null}
    </>
  );
}

/** Shows a "Search this area" button after the user pans/zooms the map. */
function SearchThisAreaButton() {
  const map = useMap();
  const { setParams } = useDirectoryFilters();
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    if (!map) return;
    const onMove = () => setMoved(true);
    const l1 = map.addListener("dragend", onMove);
    const l2 = map.addListener("zoom_changed", onMove);
    return () => {
      l1.remove();
      l2.remove();
    };
  }, [map]);

  if (!moved) return null;

  const searchHere = () => {
    const bounds = map?.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    // [west, south, east, north]
    const bbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];
    setParams((p) => {
      p.set("bbox", bbox.map((n) => n.toFixed(5)).join(","));
      p.delete("city");
    });
    setMoved(false);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      <Button
        size="sm"
        onClick={searchHere}
        className="pointer-events-auto shadow-lg"
      >
        Search this area
      </Button>
    </div>
  );
}
