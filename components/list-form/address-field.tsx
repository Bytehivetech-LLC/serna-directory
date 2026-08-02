"use client";

import { useEffect, useRef } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AddressValue = {
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
};
export type AddressGeo = {
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
};

export function AddressField({
  value,
  onChange,
  onGeo,
  apiKey,
}: {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  onGeo: (geo: AddressGeo) => void;
  apiKey?: string;
}) {
  const manual = (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="addr-line">Street address</Label>
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <PlacesInput value={value.address_line} onChange={onChange} onGeo={onGeo} />
          </APIProvider>
        ) : (
          <Input
            id="addr-line"
            value={value.address_line}
            onChange={(e) => onChange({ address_line: e.target.value })}
            placeholder="123 Main St"
            autoComplete="off"
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-city">City</Label>
        <Input
          id="addr-city"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="Tempe"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-state">State</Label>
        <Input
          id="addr-state"
          value={value.state}
          onChange={(e) => onChange({ state: e.target.value })}
          placeholder="AZ"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-zip">ZIP</Label>
        <Input
          id="addr-zip"
          value={value.postal_code}
          onChange={(e) => onChange({ postal_code: e.target.value })}
          placeholder="85281"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {manual}
      <p className="text-xs text-muted-foreground">
        {apiKey
          ? "Start typing your address for suggestions, or fill it in manually."
          : "We'll place you on the map from this address."}
      </p>
    </div>
  );
}

/** Street input wired to Google Places Autocomplete, US-restricted. */
function PlacesInput({
  value,
  onChange,
  onGeo,
}: {
  value: string;
  onChange: (patch: Partial<AddressValue>) => void;
  onGeo: (geo: AddressGeo) => void;
}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const autocomplete = new places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "place_id"],
      types: ["address"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const get = (type: string, short = false) => {
        const c = place.address_components?.find((x) => x.types.includes(type));
        return (short ? c?.short_name : c?.long_name) ?? "";
      };
      const streetNumber = get("street_number");
      const route = get("route");
      onChange({
        address_line: [streetNumber, route].filter(Boolean).join(" "),
        city: get("locality") || get("sublocality") || get("postal_town"),
        state: get("administrative_area_level_1", true),
        postal_code: get("postal_code"),
      });
      onGeo({
        latitude: place.geometry?.location?.lat() ?? null,
        longitude: place.geometry?.location?.lng() ?? null,
        google_place_id: place.place_id ?? null,
      });
    });
    return () => listener.remove();
  }, [places, onChange, onGeo]);

  return (
    <Input
      ref={inputRef}
      id="addr-line"
      defaultValue={value}
      placeholder="Start typing your address…"
      autoComplete="off"
    />
  );
}
