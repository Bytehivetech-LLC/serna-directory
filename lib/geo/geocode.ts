import "server-only";

export type Geocoded = { lat: number; lng: number; placeId: string | null };

/**
 * Server-side geocoding with the restricted server key (GOOGLE_GEOCODING_API_KEY).
 * Used when a listing was entered manually (no Places coordinates). Returns null
 * when unconfigured or nothing matched.
 */
export async function geocodeAddress(parts: {
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): Promise<Geocoded | null> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) return null;
  const address = [parts.address_line, parts.city, parts.state, parts.postal_code]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!address) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=us&key=${key}`,
    );
    const data = (await res.json()) as {
      results?: {
        geometry?: { location?: { lat: number; lng: number } };
        place_id?: string;
      }[];
    };
    const r = data.results?.[0];
    const loc = r?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng, placeId: r?.place_id ?? null };
  } catch {
    return null;
  }
}
