import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getOwnerListings, getListingLimit } from "@/lib/dashboard/queries";
import { getListFormConfig } from "@/lib/list-form/queries";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { NewListingForm } from "@/components/dashboard/new-listing-form";
import type { ListingFormInitial } from "@/components/list-form/listing-form";

export const metadata: Metadata = { title: "Add a listing" };

export default async function NewListingPage() {
  const user = await requireUser();

  const [listings, limit] = await Promise.all([
    getOwnerListings(user.id),
    getListingLimit(user.id),
  ]);

  // At the plan limit → upgrade prompt instead of the form.
  if (listings.length >= limit) {
    return (
      <div className="space-y-6">
        <PageHeading title="Add a listing" />
        <EmptyState
          icon={Lock}
          title={`You're using all ${limit} of your listing${limit === 1 ? "" : "s"}`}
          description="Upgrade your plan to publish another listing, or free one up by removing an existing listing."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/dashboard/billing">Upgrade plan</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/listings">Back to listings</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const [config, settings, { data: profile }] = await Promise.all([
    getListFormConfig(),
    getSettings(["google_maps_browser_key"]),
    createClient().then((s) =>
      s.from("profiles").select("full_name, email, phone").eq("id", user.id).maybeSingle(),
    ),
  ]);
  const mapsKey =
    typeof settings.google_maps_browser_key === "string"
      ? settings.google_maps_browser_key.trim() || undefined
      : undefined;

  // Pre-fill the owner's contact details so they don't retype them.
  const initial: ListingFormInitial = {
    categorySlug: null,
    values: {
      contact_name: profile?.full_name ?? "",
      contact_email: profile?.email ?? user.email ?? "",
      contact_phone: profile?.phone ?? "",
      accepts_esa: "unsure",
    },
    tagSlugs: [],
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Add a listing"
        lede="Fill out as much as you can — richer listings get more inquiries."
      />
      <NewListingForm config={config} mapsKey={mapsKey} initial={initial} />
    </div>
  );
}
