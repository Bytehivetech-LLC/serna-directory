"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { executeRecaptcha } from "@/lib/security/recaptcha-client";
import { submitListingAction, type SubmitResult } from "@/lib/list-form/actions";
import type { ListingSubmitInput } from "@/lib/list-form/submit-schema";
import {
  computeStrength,
  missingRequired,
  nextSuggestion,
  type FormValues,
} from "@/lib/list-form/strength";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type DraftSnapshot,
} from "@/lib/list-form/autosave";
import type { ProcessedImage } from "@/lib/list-form/image-processing";
import type { ListFormConfig, FormField } from "@/lib/list-form/types";
import { cn } from "@/lib/utils/cn";
import { SectionCard } from "@/components/layout/section-card";
import { DynamicField } from "./dynamic-field";
import { PhotoUploader } from "./photo-uploader";
import { TagAccordions } from "./tag-accordions";
import { PackageCards } from "./package-cards";
import { AddressField, type AddressGeo } from "./address-field";
import { StrengthBar } from "./strength-bar";
import { SuccessScreen } from "./success-screen";

const ADDRESS_COLUMNS = new Set(["address_line", "city", "state"]);
const LABEL_OVERRIDE: Record<string, "agesLabel" | "rateLabel"> = {
  ages_served: "agesLabel",
  rate_text: "rateLabel",
};

/** A photo already saved on the listing (edit flow), with a removal handler. */
export type ExistingImage = { id: string; thumbUrl: string };

export type ListingFormInitial = {
  categorySlug: string | null;
  values: FormValues;
  tagSlugs: string[];
  packageSlug?: string;
  showPhone?: boolean;
  geo?: AddressGeo;
};

export function ListingForm({
  config,
  mapsKey,
  initial,
  submitFn = submitListingAction,
  existingImages = [],
  onRemoveExistingImage,
  redirectOnSuccess,
  reviewNote,
  recaptchaAction = "list_program",
  submitLabel,
}: {
  config: ListFormConfig;
  mapsKey?: string;
  /** Seed the form (owner create/edit). Omit for the anonymous new-listing flow. */
  initial?: ListingFormInitial;
  /** Server action that persists the listing. Defaults to the anonymous flow. */
  submitFn?: (input: ListingSubmitInput) => Promise<SubmitResult>;
  /** Photos already on the listing (edit flow only). */
  existingImages?: ExistingImage[];
  /** Removes a saved photo; resolves ok/err. Required to show remove buttons. */
  onRemoveExistingImage?: (
    imageId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** When set, navigate here on success instead of showing the share screen. */
  redirectOnSuccess?: (r: { listingId: string; slug: string }) => string;
  /** Shown just above the submit button (e.g. the re-review rule for edits). */
  reviewNote?: ReactNode;
  recaptchaAction?: string;
  submitLabel?: string;
}) {
  // Owner flows seed the form and skip the localStorage draft entirely.
  const useDraft = !initial;

  const defaultPackage =
    initial?.packageSlug ??
    config.packages.find((p) => p.isDefault)?.slug ??
    config.packages[0]?.slug ??
    "free";

  const [categorySlug, setCategorySlug] = useState<string | null>(
    initial?.categorySlug ?? null,
  );
  const [values, setValues] = useState<FormValues>(initial?.values ?? {});
  const [tagSlugs, setTagSlugs] = useState<Set<string>>(
    new Set(initial?.tagSlugs ?? []),
  );
  const [packageSlug, setPackageSlug] = useState(defaultPackage);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [existing, setExisting] = useState<ExistingImage[]>(existingImages);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const showPhone = initial?.showPhone ?? true;
  const [geo, setGeo] = useState<AddressGeo>(
    initial?.geo ?? {
      latitude: null,
      longitude: null,
      google_place_id: null,
    },
  );
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<{ url: string; featured: boolean } | null>(
    null,
  );
  const restored = useRef(false);

  const category = config.categories.find((c) => c.slug === categorySlug) ?? null;

  // Restore autosaved draft once (anonymous new-listing flow only).
  useEffect(() => {
    if (!useDraft || restored.current) return;
    restored.current = true;
    const draft = loadDraft();
    if (draft) {
      setCategorySlug(draft.categorySlug);
      setValues(draft.values ?? {});
      setTagSlugs(new Set(draft.tagSlugs ?? []));
      setPackageSlug(draft.packageSlug || defaultPackage);
      if (draft.address) setValues((v) => ({ ...v, ...draft.address }));
    }
  }, [defaultPackage, useDraft]);

  // Autosave (debounced) — text only, never photos. Anonymous flow only.
  useEffect(() => {
    if (!useDraft) return;
    const snapshot: DraftSnapshot = {
      categorySlug,
      values,
      tagSlugs: [...tagSlugs],
      packageSlug,
      address: {
        address_line: values.address_line ?? "",
        city: values.city ?? "",
        state: values.state ?? "",
        postal_code: values.postal_code ?? "",
      },
    };
    const id = setTimeout(() => saveDraft(snapshot), 1500);
    return () => clearTimeout(id);
  }, [categorySlug, values, tagSlugs, packageSlug, useDraft]);

  async function removeExisting(imageId: string) {
    if (!onRemoveExistingImage) return;
    setRemovingId(imageId);
    const res = await onRemoveExistingImage(imageId);
    setRemovingId(null);
    if (res.ok) {
      setExisting((prev) => prev.filter((img) => img.id !== imageId));
    } else {
      toast.error(res.error ?? "Couldn't remove that photo.");
    }
  }

  const selectedPackage =
    config.packages.find((p) => p.slug === packageSlug) ?? config.packages[0];
  const maxImages = selectedPackage?.maxImages ?? 8;
  const totalImages = existing.length + images.length;

  const strength = useMemo(
    () => computeStrength(config, values, totalImages),
    [config, values, totalImages],
  );
  const missing = useMemo(
    () => missingRequired(config, values, Boolean(categorySlug)),
    [config, values, categorySlug],
  );
  const canPublish = missing.length === 0;

  const setValue = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const toggleTag = (slug: string) =>
    setTagSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const effectiveLabel = (field: FormField): string => {
    const override = LABEL_OVERRIDE[field.columnName ?? ""];
    if (override && category?.[override]) return category[override] as string;
    return field.label;
  };

  const visibleTagGroups = config.tagGroups.filter(
    (g) => g.categoryId === null || (category && g.categoryId === category.id),
  );

  const strengthMessage = (() => {
    if (!canPublish) {
      return (
        <>
          <b className="text-ink">Listing strength: {strength.percent}%.</b> To
          publish, just add: {missing.join(", ")}.
        </>
      );
    }
    const tip = nextSuggestion(config, values, totalImages);
    if (strength.percent >= 100) {
      return (
        <>
          <b className="text-ink">Listing strength: 100%.</b> Perfect — this is
          exactly what families want to see.
        </>
      );
    }
    return (
      <>
        <b className="text-ink">Listing strength: {strength.percent}%.</b>{" "}
        {strength.percent < 70 ? "Ready to publish —" : "Looking great —"}{" "}
        {tip}
      </>
    );
  })();

  async function handlePublish() {
    if (!canPublish || !category) return;
    setPending(true);
    try {
      const token = await executeRecaptcha(recaptchaAction);
      const result = await submitFn({
        categorySlug: category.slug,
        packageSlug,
        core: {
          business_name: values.business_name ?? "",
          contact_name: values.contact_name ?? "",
          contact_email: values.contact_email ?? "",
          contact_phone: values.contact_phone,
          website: values.website,
          description: values.description ?? "",
          address_line: values.address_line,
          city: values.city,
          state: values.state,
          postal_code: values.postal_code,
          also_serves: values.also_serves,
          ages_served: values.ages_served,
          rate_text: values.rate_text,
          accepts_esa: (values.accepts_esa ?? "unsure") as
            | "yes"
            | "no"
            | "unsure",
        },
        showPhone,
        tagSlugs: [...tagSlugs],
        geo,
        customFields: {},
        imageCount: images.length,
        recaptchaToken: token ?? undefined,
      });

      if (!result.ok) {
        toast.error(result.error ?? "Please check the form and try again.");
        setPending(false);
        return;
      }

      // Existing account → sign in and finish (the server saved a draft).
      if (result.mode === "existing") {
        if (useDraft) clearDraft();
        toast.message(result.message);
        window.location.href = result.redirectTo;
        return;
      }

      // Upload processed photos browser → Supabase via the signed URLs.
      if (result.uploads.length) {
        const supabase = createClient();
        await Promise.all(
          result.uploads.map(async (u, i) => {
            const img = images[i];
            if (!img) return;
            await supabase.storage
              .from("listing-images")
              .uploadToSignedUrl(u.fullPath, u.fullToken, img.fullBlob, {
                contentType: "image/webp",
              });
            await supabase.storage
              .from("listing-images")
              .uploadToSignedUrl(u.thumbPath, u.thumbToken, img.thumbBlob, {
                contentType: "image/webp",
              });
          }),
        );
      }

      if (useDraft) clearDraft();

      // Owner create/edit → back to the dashboard listing. Anonymous → share screen.
      if (redirectOnSuccess) {
        toast.success("Saved.");
        window.location.href = redirectOnSuccess({
          listingId: result.listingId,
          slug: result.slug,
        });
        return;
      }

      setSuccess({
        url: `${window.location.origin}/listing/${result.slug}`,
        featured: result.featured,
      });
      window.scrollTo({ top: 0 });
    } catch {
      toast.error("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  if (success) {
    return <SuccessScreen shareUrl={success.url} featured={success.featured} />;
  }

  return (
    <div>
      {/* CATEGORY */}
      <SectionCard
        title={category ? "Category" : "What kind of business is this?"}
        description={
          category
            ? undefined
            : "Pick the closest fit — we'll only ask for fields that make sense for it."
        }
      >
        {category ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-violet">
                Category
              </div>
              <div className="font-display text-base font-bold text-ink">
                {category.name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCategorySlug(null)}
              className="text-[13px] font-bold text-violet underline underline-offset-[3px]"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {config.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorySlug(c.slug)}
                className="rounded-xl border-[1.5px] border-border-strong bg-card px-3.5 py-4 text-left text-sm font-semibold leading-tight text-ink transition-colors hover:border-violet"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {category ? (
        <div className="animate-rise space-y-6">
          <div className="rounded-xl border border-warm-border bg-warm px-5 py-4 text-sm text-[#7a5a1e]">
            <b className="text-[#5c430f]">Fill out as much as you can.</b>{" "}
            Complete listings with a rich description and photos rank higher and
            get far more inquiries. Worth the extra few minutes.
          </div>

          {config.sections
            .filter((s) => s.key !== "category")
            .map((section) => (
              <SectionCard
                key={section.id}
                title={
                  section.key === "details" && category
                    ? `${category.name} details`
                    : section.title
                }
                description={section.subtitle ?? undefined}
              >
                {section.key === "photos" ? (
                  <div className="space-y-4">
                    {existing.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {existing.map((img) => (
                          <div
                            key={img.id}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.thumbUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {onRemoveExistingImage ? (
                              <button
                                type="button"
                                onClick={() => removeExisting(img.id)}
                                disabled={removingId === img.id}
                                aria-label="Remove photo"
                                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <PhotoUploader
                      images={images}
                      onChange={setImages}
                      max={Math.max(0, maxImages - existing.length)}
                    />
                  </div>
                ) : section.key === "tags" ? (
                  visibleTagGroups.length ? (
                    <TagAccordions
                      groups={visibleTagGroups}
                      selected={tagSlugs}
                      onToggle={toggleTag}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No tags for this category yet.
                    </p>
                  )
                ) : section.key === "package" ? (
                  <>
                    <PackageCards
                      packages={config.packages}
                      selectedSlug={packageSlug}
                      onSelect={setPackageSlug}
                    />
                    {/* Add-on picker slot — Phase 13. Intentionally empty. */}
                    <div data-addon-slot className="mt-4" />
                  </>
                ) : (
                  <SectionFields
                    section={section}
                    values={values}
                    setValue={setValue}
                    effectiveLabel={effectiveLabel}
                    mapsKey={mapsKey}
                    onAddress={(patch) =>
                      setValues((v) => ({ ...v, ...patch }))
                    }
                    onGeo={setGeo}
                    addressValue={{
                      address_line: values.address_line ?? "",
                      city: values.city ?? "",
                      state: values.state ?? "",
                      postal_code: values.postal_code ?? "",
                    }}
                  />
                )}
              </SectionCard>
            ))}

          {reviewNote ? (
            <div className="rounded-xl border border-warm-border bg-warm px-5 py-4 text-sm text-[#7a5a1e]">
              {reviewNote}
            </div>
          ) : null}

          <StrengthBar
            percent={strength.percent}
            message={strengthMessage}
            canPublish={canPublish}
            pending={pending}
            submitLabel={
              submitLabel ??
              (selectedPackage?.priceCents
                ? "Publish & continue to checkout"
                : "Publish my listing")
            }
            onPublish={handlePublish}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Renders a section's fields, swapping the address columns for AddressField. */
function SectionFields({
  section,
  values,
  setValue,
  effectiveLabel,
  mapsKey,
  onAddress,
  onGeo,
  addressValue,
}: {
  section: ListFormConfig["sections"][number];
  values: FormValues;
  setValue: (key: string, value: string) => void;
  effectiveLabel: (field: FormField) => string;
  mapsKey?: string;
  onAddress: (patch: Record<string, string>) => void;
  onGeo: (geo: AddressGeo) => void;
  addressValue: {
    address_line: string;
    city: string;
    state: string;
    postal_code: string;
  };
}) {
  const hasAddress = section.fields.some((f) =>
    ADDRESS_COLUMNS.has(f.columnName ?? ""),
  );

  return (
    <div className="space-y-4">
      {hasAddress ? (
        <AddressField
          value={addressValue}
          onChange={(patch) =>
            onAddress(patch as unknown as Record<string, string>)
          }
          onGeo={onGeo}
          apiKey={mapsKey}
        />
      ) : null}

      {section.fields
        .filter((f) => !ADDRESS_COLUMNS.has(f.columnName ?? ""))
        .map((field) => (
          <DynamicField
            key={field.id}
            field={field}
            label={effectiveLabel(field)}
            value={values[field.key] ?? ""}
            onChange={(v) => setValue(field.key, v)}
          />
        ))}
    </div>
  );
}
