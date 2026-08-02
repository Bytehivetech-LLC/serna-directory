"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { sendTemplateEmail } from "@/lib/email/send";
import { getSettings } from "@/lib/settings";
import type { AdminActionResult } from "./users-actions";

const WEB = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const idSchema = z.string().uuid();
const idsSchema = z.array(z.string().uuid()).min(1).max(500);
const reasonSchema = z
  .string()
  .trim()
  .min(5, "Give the owner a clear reason (at least a sentence).")
  .max(2000);

type Admin = ReturnType<typeof createAdminClient>;

type ListingLite = {
  id: string;
  slug: string | null;
  business_name: string;
  contact_email: string | null;
  contact_name: string | null;
  owner_id: string;
  status: string;
  is_featured: boolean;
  featured_until: string | null;
  deleted_at: string | null;
};

const LITE_COLS =
  "id, slug, business_name, contact_email, contact_name, owner_id, status, is_featured, featured_until, deleted_at";

async function loadListing(admin: Admin, id: string): Promise<ListingLite | null> {
  const { data } = await admin
    .from("listings")
    .select(LITE_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as ListingLite | null) ?? null;
}

function listingPath(slug: string | null): string {
  return `${WEB}/listing/${slug ?? ""}`;
}
function editLink(id: string): string {
  return `${WEB}/dashboard/listings/${id}/edit`;
}

/** Revalidate the public surfaces a status change affects. */
function revalidatePublic(slug: string | null) {
  revalidatePath("/");
  if (slug) revalidatePath(`/listing/${slug}`);
  revalidatePath("/admin/listings");
  revalidatePath("/admin/listings/review");
}

/* -------------------------------------------------------------- approve --- */

export async function approveListingAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const session = await getSession();
  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("listings")
    .update({
      status: "published",
      published_at: nowIso,
      reviewed_at: nowIso,
      reviewed_by: session?.user?.id ?? null,
      rejection_reason: null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't approve that listing." };

  await logAudit({
    action: "listing.approve",
    entityType: "listing",
    entityId: id,
    before: { status: listing.status },
    after: { status: "published" },
  });

  if (listing.contact_email) {
    await sendTemplateEmail("listing_approved", {
      to: listing.contact_email,
      userId: listing.owner_id,
      listingId: id,
      context: {
        owner_name: listing.contact_name ?? "there",
        listing_name: listing.business_name,
        listing_path: listingPath(listing.slug),
      },
    });
  }

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} is now live.` };
}

/* --------------------------------------------------------------- reject --- */

export async function rejectListingAction(
  id: string,
  reason: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };
  const reasonOk = reasonSchema.safeParse(reason);
  if (!reasonOk.success) return { ok: false, error: reasonOk.error.issues[0]!.message };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const session = await getSession();
  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("listings")
    .update({
      status: "rejected",
      rejection_reason: reasonOk.data,
      reviewed_at: nowIso,
      reviewed_by: session?.user?.id ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't reject that listing." };

  await logAudit({
    action: "listing.reject",
    entityType: "listing",
    entityId: id,
    before: { status: listing.status },
    after: { status: "rejected" },
    meta: { reason: reasonOk.data },
  });

  if (listing.contact_email) {
    await sendTemplateEmail("listing_rejected", {
      to: listing.contact_email,
      userId: listing.owner_id,
      listingId: id,
      context: {
        owner_name: listing.contact_name ?? "there",
        listing_name: listing.business_name,
        reason: reasonOk.data,
        edit_link: editLink(id),
      },
    });
  }

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} rejected. The owner was emailed.` };
}

/* ------------------------------------------------------- request changes --- */

export async function requestChangesListingAction(
  id: string,
  reason: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };
  const reasonOk = reasonSchema.safeParse(reason);
  if (!reasonOk.success) return { ok: false, error: reasonOk.error.issues[0]!.message };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const session = await getSession();
  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("listings")
    .update({
      status: "draft",
      rejection_reason: reasonOk.data,
      reviewed_at: nowIso,
      reviewed_by: session?.user?.id ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't send that back for changes." };

  await logAudit({
    action: "listing.request_changes",
    entityType: "listing",
    entityId: id,
    before: { status: listing.status },
    after: { status: "draft" },
    meta: { reason: reasonOk.data },
  });

  if (listing.contact_email) {
    await sendTemplateEmail("listing_changes_requested", {
      to: listing.contact_email,
      userId: listing.owner_id,
      listingId: id,
      context: {
        owner_name: listing.contact_name ?? "there",
        listing_name: listing.business_name,
        reason: reasonOk.data,
        edit_link: editLink(id),
      },
    });
  }

  revalidatePublic(listing.slug);
  return {
    ok: true,
    message: `Changes requested. ${listing.business_name} moved back to draft and the owner was emailed.`,
  };
}

/* ------------------------------------------------------------ unpublish --- */

export async function unpublishListingAction(
  id: string,
  note?: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const { error } = await admin
    .from("listings")
    .update({ status: "unpublished" })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't unpublish that listing." };

  await logAudit({
    action: "listing.unpublish",
    entityType: "listing",
    entityId: id,
    before: { status: listing.status },
    after: { status: "unpublished" },
    meta: note?.trim() ? { note: note.trim() } : undefined,
  });

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} unpublished.` };
}

/* -------------------------------------------------------- feature toggle --- */

const featureSchema = z.object({
  featuredUntil: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.")
    .optional()
    .nullable(),
});

export async function featureListingAction(
  id: string,
  featuredUntil: string | null,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };
  const parsed = featureSchema.safeParse({ featuredUntil });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  // Store the expiry as an end-of-day timestamp so it stays featured all day.
  const until = parsed.data.featuredUntil
    ? new Date(`${parsed.data.featuredUntil}T23:59:59Z`).toISOString()
    : null;

  const { error } = await admin
    .from("listings")
    .update({ is_featured: true, featured_until: until })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't feature that listing." };

  await logAudit({
    action: "listing.feature",
    entityType: "listing",
    entityId: id,
    before: { is_featured: listing.is_featured, featured_until: listing.featured_until },
    after: { is_featured: true, featured_until: until },
  });

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} is now featured.` };
}

export async function unfeatureListingAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const { error } = await admin
    .from("listings")
    .update({ is_featured: false, featured_until: null })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't unfeature that listing." };

  await logAudit({
    action: "listing.unfeature",
    entityType: "listing",
    entityId: id,
    before: { is_featured: listing.is_featured, featured_until: listing.featured_until },
    after: { is_featured: false, featured_until: null },
  });

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} is no longer featured.` };
}

/* --------------------------------------------------- soft delete / restore --- */

export async function softDeleteListingAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const { error } = await admin
    .from("listings")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete that listing." };

  await logAudit({
    action: "listing.delete",
    entityType: "listing",
    entityId: id,
    before: { status: listing.status, deleted_at: null },
    after: { status: "archived", deleted_at: "set" },
  });

  // Soft delete keeps the photos; tell the owner about the grace window.
  const settings = await getSettings(["deletion_grace_days"]);
  const graceDays = typeof settings.deletion_grace_days === "number" ? settings.deletion_grace_days : 30;
  if (listing.contact_email) {
    await sendTemplateEmail("listing_deleted", {
      to: listing.contact_email,
      userId: listing.owner_id,
      listingId: id,
      context: {
        owner_name: listing.contact_name ?? "there",
        listing_name: listing.business_name,
        grace_period: graceDays,
      },
    });
  }

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} deleted.` };
}

/** Hard delete — the cascade + DB trigger enqueue every photo for removal. */
export async function permanentDeleteListingAction(
  id: string,
  confirm: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };
  if (confirm !== "DELETE PERMANENTLY") {
    return { ok: false, error: 'Type "DELETE PERMANENTLY" to confirm.' };
  }
  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const { error } = await admin.from("listings").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't permanently delete that listing." };

  await logAudit({
    action: "listing.purge",
    entityType: "listing",
    entityId: id,
    meta: { name: listing.business_name },
  });
  revalidatePublic(listing.slug);
  revalidatePath("/admin/listings");
  return { ok: true, message: `${listing.business_name} permanently deleted. Its photos are queued for removal.` };
}

export async function restoreListingAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  // Restore to unpublished — never straight back to public without a review.
  const { error } = await admin
    .from("listings")
    .update({ deleted_at: null, status: "unpublished" })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't restore that listing." };

  await logAudit({
    action: "listing.restore",
    entityType: "listing",
    entityId: id,
    before: { status: listing.status, deleted_at: "set" },
    after: { status: "unpublished", deleted_at: null },
  });

  revalidatePublic(listing.slug);
  return { ok: true, message: `${listing.business_name} restored (unpublished).` };
}

/* --------------------------------------------------------- reassign owner --- */

export async function reassignOwnerAction(
  id: string,
  ownerEmail: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };
  const emailOk = z.string().trim().toLowerCase().email().safeParse(ownerEmail);
  if (!emailOk.success) return { ok: false, error: "Enter a valid email." };

  const admin = createAdminClient();
  const listing = await loadListing(admin, id);
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const { data: newOwner } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", emailOk.data)
    .maybeSingle();
  if (!newOwner) {
    return { ok: false, error: "No account with that email. They must register first." };
  }
  if (newOwner.id === listing.owner_id) {
    return { ok: false, error: "That user already owns this listing." };
  }

  const { error } = await admin
    .from("listings")
    .update({ owner_id: newOwner.id })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't reassign that listing." };

  await logAudit({
    action: "listing.reassign_owner",
    entityType: "listing",
    entityId: id,
    before: { owner_id: listing.owner_id },
    after: { owner_id: newOwner.id },
    meta: { new_owner_email: newOwner.email },
  });

  revalidatePath(`/admin/listings/${id}`);
  return { ok: true, message: `Owner reassigned to ${newOwner.email}.` };
}

/* ------------------------------------------------------ full admin update --- */

const updateSchema = z.object({
  business_name: z.string().trim().min(2).max(120),
  contact_name: z.string().trim().max(120).optional().nullable(),
  contact_email: z.string().trim().toLowerCase().email().max(200).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  show_phone: z.boolean().optional(),
  website: z
    .union([z.literal(""), z.string().trim().url().max(300)])
    .optional()
    .nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  package_id: z.string().uuid().optional().nullable(),
  status: z.enum([
    "draft",
    "pending_review",
    "published",
    "rejected",
    "unpublished",
    "archived",
  ]),
  address_line: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  also_serves: z.string().trim().max(300).optional().nullable(),
  ages_served: z.string().trim().max(200).optional().nullable(),
  rate_text: z.string().trim().max(200).optional().nullable(),
  accepts_esa: z.enum(["yes", "no", "unsure"]).optional().nullable(),
  priority_rank: z.number().int().min(0).max(1000).optional(),
});

function descriptionHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return DOMPurify.sanitize(paragraphs, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

export async function updateListingAction(
  id: string,
  input: z.infer<typeof updateSchema>,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid listing." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("listings")
    .select(
      "business_name, contact_name, contact_email, contact_phone, show_phone, website, description, category_id, package_id, status, address_line, city, state, postal_code, also_serves, ages_served, rate_text, accepts_esa, priority_rank, slug",
    )
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "That listing no longer exists." };

  const alsoServes = (d.also_serves ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const patch = {
    business_name: d.business_name,
    contact_name: d.contact_name ?? null,
    contact_email: d.contact_email ?? null,
    contact_phone: d.contact_phone ?? null,
    show_phone: d.show_phone ?? true,
    website: d.website ? d.website : null,
    description: d.description ?? null,
    description_html: d.description ? descriptionHtml(d.description) : null,
    category_id: d.category_id ?? before.category_id,
    package_id: d.package_id ?? null,
    status: d.status,
    address_line: d.address_line ?? null,
    city: d.city ?? null,
    state: d.state ?? null,
    postal_code: d.postal_code ?? null,
    also_serves: alsoServes,
    ages_served: d.ages_served ?? null,
    rate_text: d.rate_text ?? null,
    accepts_esa: d.accepts_esa ?? null,
    priority_rank: d.priority_rank ?? 0,
  };

  const { error } = await admin.from("listings").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save those changes." };

  await logAudit({
    action: "listing.update",
    entityType: "listing",
    entityId: id,
    before: {
      ...before,
      also_serves: Array.isArray(before.also_serves)
        ? before.also_serves.join(", ")
        : before.also_serves,
    },
    after: { ...patch, also_serves: alsoServes.join(", "), description_html: undefined },
  });

  revalidatePublic(before.slug);
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true, message: "Listing updated." };
}

/* ----------------------------------------------------------------- bulk --- */

/* ---------------------------------------------------------------- images --- */

const BUCKET = "listing-images";

export type AdminUploadTarget = {
  fullPath: string;
  fullToken: string;
  thumbPath: string;
  thumbToken: string;
};

/** Sign N upload URLs for admin-added photos and record their rows. */
export async function signAdminListingUploadsAction(
  listingId: string,
  count: number,
): Promise<
  { ok: true; uploads: AdminUploadTarget[] } | { ok: false; error: string }
> {
  await requireAdmin();
  if (!idSchema.safeParse(listingId).success) {
    return { ok: false, error: "Invalid listing." };
  }
  const n = Math.min(Math.max(0, Math.floor(count)), 12);
  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("id, business_name")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  const { count: existing } = await admin
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  const startOrder = existing ?? 0;

  const uploads: AdminUploadTarget[] = [];
  for (let i = 0; i < n; i++) {
    const uuid = crypto.randomUUID();
    const fullPath = `${listingId}/${uuid}.webp`;
    const thumbPath = `${listingId}/${uuid}_thumb.webp`;
    const [full, thumb] = await Promise.all([
      admin.storage.from(BUCKET).createSignedUploadUrl(fullPath),
      admin.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
    ]);
    if (!full.data || !thumb.data) continue;
    uploads.push({
      fullPath,
      fullToken: full.data.token,
      thumbPath,
      thumbToken: thumb.data.token,
    });
    await admin.from("listing_images").insert({
      listing_id: listingId,
      storage_path: fullPath,
      thumb_path: thumbPath,
      is_cover: startOrder === 0 && i === 0,
      sort_order: startOrder + i,
      alt_text: listing.business_name,
    });
  }

  await logAudit({
    action: "listing.images_add",
    entityType: "listing",
    entityId: listingId,
    meta: { added: uploads.length },
  });
  revalidatePath(`/admin/listings/${listingId}`);
  return { ok: true, uploads };
}

export async function deleteAdminListingImageAction(
  imageId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(imageId).success) {
    return { ok: false, error: "Invalid image." };
  }
  const admin = createAdminClient();
  const { data: image } = await admin
    .from("listing_images")
    .select("id, listing_id, is_cover")
    .eq("id", imageId)
    .maybeSingle();
  if (!image) return { ok: false, error: "That photo no longer exists." };

  const { error } = await admin.from("listing_images").delete().eq("id", imageId);
  if (error) return { ok: false, error: "Couldn't remove that photo." };

  // Promote a new cover if we removed the current one.
  if (image.is_cover) {
    const { data: next } = await admin
      .from("listing_images")
      .select("id")
      .eq("listing_id", image.listing_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin.from("listing_images").update({ is_cover: true }).eq("id", next.id);
    }
  }

  await logAudit({
    action: "listing.image_remove",
    entityType: "listing",
    entityId: image.listing_id,
    meta: { image_id: imageId },
  });
  revalidatePath(`/admin/listings/${image.listing_id}`);
  return { ok: true, message: "Photo removed." };
}

export async function setAdminCoverImageAction(
  imageId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(imageId).success) {
    return { ok: false, error: "Invalid image." };
  }
  const admin = createAdminClient();
  const { data: image } = await admin
    .from("listing_images")
    .select("id, listing_id")
    .eq("id", imageId)
    .maybeSingle();
  if (!image) return { ok: false, error: "That photo no longer exists." };

  await admin
    .from("listing_images")
    .update({ is_cover: false })
    .eq("listing_id", image.listing_id);
  const { error } = await admin
    .from("listing_images")
    .update({ is_cover: true })
    .eq("id", imageId);
  if (error) return { ok: false, error: "Couldn't set the cover." };

  await logAudit({
    action: "listing.image_cover",
    entityType: "listing",
    entityId: image.listing_id,
    meta: { image_id: imageId },
  });
  revalidatePath(`/admin/listings/${image.listing_id}`);
  return { ok: true, message: "Cover updated." };
}

/* ----------------------------------------------------------------- bulk --- */

export async function bulkApproveListingsAction(
  ids: string[],
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "No listings selected." };

  let count = 0;
  for (const id of parsed.data) {
    const res = await approveListingAction(id);
    if (res.ok) count += 1;
  }
  revalidatePath("/admin/listings");
  return { ok: true, message: `${count} ${count === 1 ? "listing" : "listings"} approved.` };
}

export async function bulkUnpublishListingsAction(
  ids: string[],
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "No listings selected." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("listings")
    .update({ status: "unpublished" })
    .in("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't unpublish those listings." };

  await logAudit({
    action: "listing.unpublish",
    entityType: "listing",
    entityId: parsed.data.length === 1 ? parsed.data[0] : null,
    meta: { count: parsed.data.length, ids: parsed.data, bulk: true },
  });
  revalidatePath("/");
  revalidatePath("/admin/listings");
  return {
    ok: true,
    message: `${parsed.data.length} ${parsed.data.length === 1 ? "listing" : "listings"} unpublished.`,
  };
}

export async function bulkDeleteListingsAction(
  ids: string[],
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "No listings selected." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("listings")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .in("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't delete those listings." };

  await logAudit({
    action: "listing.delete",
    entityType: "listing",
    entityId: parsed.data.length === 1 ? parsed.data[0] : null,
    meta: { count: parsed.data.length, ids: parsed.data, bulk: true },
  });
  revalidatePath("/");
  revalidatePath("/admin/listings");
  return {
    ok: true,
    message: `${parsed.data.length} ${parsed.data.length === 1 ? "listing" : "listings"} deleted.`,
  };
}
