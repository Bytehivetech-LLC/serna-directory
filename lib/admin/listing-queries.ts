import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { mapListingDetail } from "@/lib/listing/queries";
import type { ListingDetail } from "@/lib/listing/types";
import type { Listing } from "@/types";

const IMAGE_BUCKET = "listing-images";

/* ------------------------------------------------------------- table ------ */

export type ListingsQuery = {
  q?: string;
  status?: string;
  categoryId?: string;
  packageId?: string;
  esa?: string;
  featured?: boolean;
  city?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type AdminListingRow = {
  id: string;
  slug: string | null;
  business_name: string;
  owner_email: string | null;
  category_name: string | null;
  package_name: string | null;
  status: string;
  is_featured: boolean;
  completeness: number;
  city: string | null;
  submitted_at: string | null;
  created_at: string;
  cover_url: string | null;
};

export type AdminListingsPage = {
  rows: AdminListingRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getAdminListingsPage(
  query: ListingsQuery,
): Promise<AdminListingsPage> {
  await requireAdmin();
  const admin = createAdminClient();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

  const { data, error } = await admin.rpc("admin_list_listings", {
    p_q: query.q?.trim() || null,
    p_status: query.status || null,
    p_category_id: query.categoryId || null,
    p_package_id: query.packageId || null,
    p_esa: query.esa || null,
    p_featured: query.featured ?? null,
    p_city: query.city?.trim() || null,
    p_from: query.from || null,
    p_to: query.to || null,
    p_sort: query.sort ?? "submitted",
    p_dir: query.dir ?? "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error || !data) {
    return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  }

  const coverUrl = (path: string | null) =>
    path ? admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl : null;

  const raw = data as {
    id: string;
    slug: string | null;
    business_name: string;
    owner_email: string | null;
    category_name: string | null;
    package_name: string | null;
    status: string;
    is_featured: boolean;
    completeness: number;
    city: string | null;
    submitted_at: string | null;
    created_at: string;
    cover_path: string | null;
    total_count: number;
  }[];

  const total = raw[0]?.total_count ?? 0;
  const rows: AdminListingRow[] = raw.map(({ total_count: _t, cover_path, ...r }) => ({
    ...r,
    cover_url: coverUrl(cover_path),
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ---------------------------------------------------------- detail -------- */

export type AdminListingDetail = {
  detail: ListingDetail;
  listing: Listing;
  ownerEmail: string | null;
  images: { id: string; thumbUrl: string; isCover: boolean; sortOrder: number }[];
};

export async function getAdminListingDetail(
  id: string,
): Promise<AdminListingDetail | null> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!listing) return null;

  const [{ data: owner }, { data: imageRows }] = await Promise.all([
    admin.from("profiles").select("email").eq("id", listing.owner_id).maybeSingle(),
    admin
      .from("listing_images")
      .select("id, thumb_path, storage_path, is_cover, sort_order")
      .eq("listing_id", id)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  const detail = await mapListingDetail(admin, listing);

  const images = (imageRows ?? []).map((img) => ({
    id: img.id,
    thumbUrl: admin.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(img.thumb_path ?? img.storage_path).data.publicUrl,
    isCover: Boolean(img.is_cover),
    sortOrder: img.sort_order ?? 0,
  }));

  return { detail, listing, ownerEmail: owner?.email ?? null, images };
}

/* -------------------------------------------------- review queue --------- */

export type ReviewItem = {
  detail: ListingDetail;
  remaining: number;
  submittedAt: string | null;
};

/**
 * The next listing awaiting review, oldest first, skipping any ids the reviewer
 * has already passed on this session. Returns the item + how many remain.
 */
export async function getNextPendingReview(
  skipIds: string[] = [],
): Promise<ReviewItem | null> {
  await requireAdmin();
  const admin = createAdminClient();

  const { count } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review")
    .is("deleted_at", null);

  let q = admin
    .from("listings")
    .select("*")
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (skipIds.length) q = q.not("id", "in", `(${skipIds.join(",")})`);

  const { data: listing } = await q.limit(1).maybeSingle();
  if (!listing) return null;

  const detail = await mapListingDetail(admin, listing);
  return {
    detail,
    remaining: count ?? 0,
    submittedAt: listing.submitted_at,
  };
}

/* -------------------------------------------------- audit trail ---------- */

export async function getListingAudit(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select("id, actor_email, action, diff, created_at")
    .eq("entity_type", "listing")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(40);
  return data ?? [];
}

/* -------------------------------------------------- lookups -------------- */

export async function getListingLookups() {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: categories }, { data: packages }] = await Promise.all([
    admin.from("categories").select("id, name").order("sort_order"),
    admin.from("packages").select("id, name").order("sort_order"),
  ]);
  return { categories: categories ?? [], packages: packages ?? [] };
}
