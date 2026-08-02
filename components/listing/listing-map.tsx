"use client";

import { APIProvider, AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import { MapPinned, Navigation } from "lucide-react";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export function ListingMap({
  lat,
  lng,
  apiKey,
}: {
  lat: number;
  lng: number;
  apiKey?: string;
}) {
  const key =
    apiKey ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div>
      <div className="relative h-56 overflow-hidden rounded-xl border border-border">
        {key ? (
          <APIProvider apiKey={key}>
            <Map
              mapId={MAP_ID}
              defaultCenter={{ lat, lng }}
              defaultZoom={13}
              gestureHandling="cooperative"
              disableDefaultUI
              className="h-full w-full"
            >
              <AdvancedMarker position={{ lat, lng }}>
                <div className="h-5 w-5 rounded-full border-2 border-white bg-violet shadow-md" />
              </AdvancedMarker>
            </Map>
          </APIProvider>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 bg-secondary/40 text-center">
            <MapPinned className="h-6 w-6 text-violet/50" aria-hidden />
            <p className="text-xs text-muted-foreground">Map unavailable</p>
          </div>
        )}
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo hover:underline"
      >
        <Navigation className="h-4 w-4" />
        Get directions
      </a>
    </div>
  );
}
