"use client";

import {
  ListingForm,
  type ListingFormInitial,
  type ExistingImage,
} from "@/components/list-form/listing-form";
import {
  updateOwnerListingAction,
  deleteOwnerListingImageAction,
} from "@/lib/list-form/owner-actions";
import type { ListFormConfig } from "@/lib/list-form/types";
import type { ListingSubmitInput } from "@/lib/list-form/submit-schema";

/** Dashboard "edit listing" — the shared form, wired to the owner update action. */
export function EditListingForm({
  config,
  mapsKey,
  listingId,
  slug,
  initial,
  existingImages,
  requiresApproval,
  isPublished,
}: {
  config: ListFormConfig;
  mapsKey?: string;
  listingId: string;
  slug: string;
  initial: ListingFormInitial;
  existingImages: ExistingImage[];
  requiresApproval: boolean;
  isPublished: boolean;
}) {
  const submitFn = (input: ListingSubmitInput) =>
    updateOwnerListingAction(listingId, input);

  // Show the re-review rule up front so the change is never a surprise.
  const reviewNote =
    isPublished && requiresApproval ? (
      <>
        <b className="text-[#5c430f]">Some edits need a quick re-review.</b> Your
        listing is live on a reviewed plan, so changing the business name,
        description, category, or address sends it back to pending review before
        those changes appear in search. Everything else — photos, tags, hours,
        rates — updates instantly.
      </>
    ) : isPublished ? (
      <>
        <b className="text-[#5c430f]">Your changes go live immediately.</b> This
        listing stays published as you save.
      </>
    ) : null;

  return (
    <ListingForm
      config={config}
      mapsKey={mapsKey}
      initial={initial}
      submitFn={submitFn}
      existingImages={existingImages}
      onRemoveExistingImage={deleteOwnerListingImageAction}
      recaptchaAction="owner_listing"
      submitLabel="Save changes"
      reviewNote={reviewNote}
      redirectOnSuccess={() => `/dashboard/listings/${listingId}`}
    />
  );
}
