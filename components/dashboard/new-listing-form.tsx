"use client";

import { ListingForm, type ListingFormInitial } from "@/components/list-form/listing-form";
import { createOwnerListingAction } from "@/lib/list-form/owner-actions";
import type { ListFormConfig } from "@/lib/list-form/types";

/** Dashboard "add a listing" — the shared form, wired to the owner create action. */
export function NewListingForm({
  config,
  mapsKey,
  initial,
}: {
  config: ListFormConfig;
  mapsKey?: string;
  initial: ListingFormInitial;
}) {
  return (
    <ListingForm
      config={config}
      mapsKey={mapsKey}
      initial={initial}
      submitFn={createOwnerListingAction}
      recaptchaAction="owner_listing"
      submitLabel="Publish listing"
      redirectOnSuccess={(r) => `/dashboard/listings/${r.listingId}`}
    />
  );
}
