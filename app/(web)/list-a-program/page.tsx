import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { getListFormConfig } from "@/lib/list-form/queries";
import { getSettings } from "@/lib/settings";
import { ListingForm } from "@/components/list-form/listing-form";

export const metadata: Metadata = { title: "List your business" };

export default async function ListAProgramPage() {
  const [config, settings] = await Promise.all([
    getListFormConfig(),
    getSettings(["google_maps_browser_key"]),
  ]);
  const mapsKey =
    typeof settings.google_maps_browser_key === "string"
      ? settings.google_maps_browser_key.trim() || undefined
      : undefined;

  return (
    <PageContainer width="narrow" className="py-12">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.015em] text-ink sm:text-[42px]">
          List your business
        </h1>
        <p className="mt-3.5 max-w-[60ch] text-base text-muted-foreground">
          Tell families what you offer.{" "}
          <b className="text-ink">
            Your listing goes live instantly with a shareable link
          </b>{" "}
          — it won&apos;t appear in directory search until our team gives it a
          quick look, but you can share it right away. Free to start, no card
          required.
        </p>
      </div>

      <ListingForm config={config} mapsKey={mapsKey} />
    </PageContainer>
  );
}
