"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, EyeOff, RotateCcw, ImagePlus, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ProcessedImage } from "@/lib/list-form/image-processing";
import type { Listing } from "@/types";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PhotoUploader } from "@/components/list-form/photo-uploader";
import {
  updateListingAction,
  featureListingAction,
  unfeatureListingAction,
  unpublishListingAction,
  softDeleteListingAction,
  restoreListingAction,
  reassignOwnerAction,
  signAdminListingUploadsAction,
  deleteAdminListingImageAction,
  setAdminCoverImageAction,
} from "@/lib/admin/listing-actions";
import type { AdminActionResult } from "@/lib/admin/users-actions";

type Lookup = { id: string; name: string };
type ExistingImage = { id: string; thumbUrl: string; isCover: boolean };

const STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "unpublished",
  "archived",
] as const;

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function AdminListingEditor({
  listing,
  ownerEmail,
  images,
  categories,
  packages,
}: {
  listing: Listing;
  ownerEmail: string | null;
  images: ExistingImage[];
  categories: Lookup[];
  packages: Lookup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    business_name: listing.business_name,
    status: listing.status,
    category_id: listing.category_id,
    package_id: listing.package_id ?? "",
    priority_rank: String(listing.priority_rank ?? 0),
    contact_name: listing.contact_name ?? "",
    contact_email: listing.contact_email ?? "",
    contact_phone: listing.contact_phone ?? "",
    show_phone: Boolean(listing.show_phone),
    website: listing.website ?? "",
    description: listing.description ?? "",
    address_line: listing.address_line ?? "",
    city: listing.city ?? "",
    state: listing.state ?? "",
    postal_code: listing.postal_code ?? "",
    also_serves: Array.isArray(listing.also_serves)
      ? listing.also_serves.join(", ")
      : "",
    ages_served: listing.ages_served ?? "",
    rate_text: listing.rate_text ?? "",
    accepts_esa: listing.accepts_esa ?? "unsure",
  });

  const [featuredUntil, setFeaturedUntil] = useState(
    isoToDateInput(listing.featured_until),
  );
  const [newImages, setNewImages] = useState<ProcessedImage[]>([]);
  const [existing, setExisting] = useState<ExistingImage[]>(images);
  const [newOwner, setNewOwner] = useState("");

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  function run(fn: () => Promise<AdminActionResult>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        after?.();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function save() {
    run(() =>
      updateListingAction(listing.id, {
        business_name: form.business_name,
        status: form.status,
        category_id: form.category_id || null,
        package_id: form.package_id || null,
        priority_rank: Number(form.priority_rank) || 0,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        show_phone: form.show_phone,
        website: form.website || null,
        description: form.description || null,
        address_line: form.address_line || null,
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        also_serves: form.also_serves || null,
        ages_served: form.ages_served || null,
        rate_text: form.rate_text || null,
        accepts_esa: form.accepts_esa as "yes" | "no" | "unsure",
      }),
    );
  }

  async function uploadNew() {
    if (!newImages.length) return;
    startTransition(async () => {
      const res = await signAdminListingUploadsAction(listing.id, newImages.length);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const supabase = createClient();
      await Promise.all(
        res.uploads.map(async (u, i) => {
          const img = newImages[i];
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
      toast.success(`${res.uploads.length} photo(s) added.`);
      setNewImages([]);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Content */}
        <SectionCard title="Content">
          <div className="space-y-4">
            <Field label="Business name">
              <Input
                value={form.business_name}
                onChange={(e) => set("business_name", e.target.value)}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select
                  value={form.category_id ?? ""}
                  onChange={(v) => set("category_id", v)}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Contact name">
                <Input
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                />
              </Field>
              <Field label="Contact email">
                <Input
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                />
              </Field>
              <Field label="Website">
                <Input
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Ages / grades">
                <Input
                  value={form.ages_served}
                  onChange={(e) => set("ages_served", e.target.value)}
                />
              </Field>
              <Field label="Rate">
                <Input
                  value={form.rate_text}
                  onChange={(e) => set("rate_text", e.target.value)}
                />
              </Field>
              <Field label="Accepts ESA">
                <Select
                  value={form.accepts_esa}
                  onChange={(v) => set("accepts_esa", v)}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                    { value: "unsure", label: "Not sure" },
                  ]}
                />
              </Field>
            </div>
            <Field label="Also serves (comma-separated)">
              <Input
                value={form.also_serves}
                onChange={(e) => set("also_serves", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Address">
                <Input
                  value={form.address_line}
                  onChange={(e) => set("address_line", e.target.value)}
                />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
              </Field>
              <Field label="Postal code">
                <Input
                  value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox
                checked={form.show_phone}
                onCheckedChange={(v) => set("show_phone", Boolean(v))}
              />
              Show phone number publicly
            </label>
          </div>
        </SectionCard>

        {/* Photos */}
        <SectionCard title="Photos">
          <div className="space-y-4">
            {existing.length ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {existing.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumbUrl} alt="" className="h-full w-full object-cover" />
                    {img.isCover ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-violet px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        title="Make cover"
                        onClick={() =>
                          run(() => setAdminCoverImageAction(img.id), () =>
                            setExisting((prev) =>
                              prev.map((x) => ({ ...x, isCover: x.id === img.id })),
                            ),
                          )
                        }
                        className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Set cover
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Remove photo"
                      disabled={pending}
                      onClick={() =>
                        run(() => deleteAdminListingImageAction(img.id), () =>
                          setExisting((prev) => prev.filter((x) => x.id !== img.id)),
                        )
                      }
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" /> No photos yet.
              </p>
            )}

            <PhotoUploader images={newImages} onChange={setNewImages} max={12} />
            {newImages.length ? (
              <Button onClick={uploadNew} disabled={pending}>
                <ImagePlus className="h-4 w-4" /> Add {newImages.length} photo
                {newImages.length === 1 ? "" : "s"}
              </Button>
            ) : null}
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending} size="lg">
            Save changes
          </Button>
        </div>
      </div>

      {/* Admin controls sidebar */}
      <div className="space-y-6">
        <SectionCard title="Status & plan">
          <div className="space-y-4">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => set("status", v)}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </Field>
            <Field label="Package">
              <Select
                value={form.package_id}
                onChange={(v) => set("package_id", v)}
                options={[
                  { value: "", label: "None (free)" },
                  ...packages.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>
            <Field label="Priority rank (higher = higher in results)">
              <Input
                type="number"
                value={form.priority_rank}
                onChange={(e) => set("priority_rank", e.target.value)}
              />
            </Field>
            <p className="text-xs text-faint">
              Status & plan changes save with the <b>Save changes</b> button.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Featured">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {listing.is_featured ? "This listing is featured." : "Not featured."}
            </p>
            <Field label="Featured until (optional)">
              <Input
                type="date"
                value={featuredUntil}
                onChange={(e) => setFeaturedUntil(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => featureListingAction(listing.id, featuredUntil || null))
                }
              >
                <Star className="h-4 w-4" /> Feature
              </Button>
              {listing.is_featured ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => unfeatureListingAction(listing.id))}
                >
                  Unfeature
                </Button>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Quick actions">
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start"
              disabled={pending}
              onClick={() => run(() => unpublishListingAction(listing.id))}
            >
              <EyeOff className="h-4 w-4" /> Unpublish
            </Button>
            {listing.deleted_at ? (
              <Button
                variant="outline"
                className="justify-start"
                disabled={pending}
                onClick={() => run(() => restoreListingAction(listing.id))}
              >
                <RotateCcw className="h-4 w-4" /> Restore
              </Button>
            ) : (
              <Button
                variant="outline"
                className="justify-start border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
                disabled={pending}
                onClick={() => run(() => softDeleteListingAction(listing.id))}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Owner">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Current: <span className="text-ink">{ownerEmail ?? "—"}</span>
            </p>
            <Label htmlFor="reassign" className="text-xs text-muted-foreground">
              Reassign to email (must have an account)
            </Label>
            <div className="flex gap-2">
              <Input
                id="reassign"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="owner@example.com"
              />
              <Button
                variant="outline"
                disabled={pending || !newOwner.trim()}
                onClick={() =>
                  run(() => reassignOwnerAction(listing.id, newOwner), () =>
                    setNewOwner(""),
                  )
                }
              >
                Move
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
