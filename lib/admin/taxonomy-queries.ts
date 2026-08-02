import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { Category, TagGroup, Tag } from "@/types";

type Admin = ReturnType<typeof createAdminClient>;

/** Live listing counts (non-deleted) per category — accurate regardless of any
 * denormalised column. */
async function categoryCounts(admin: Admin): Promise<Map<string, number>> {
  const { data } = await admin
    .from("listings")
    .select("category_id")
    .is("deleted_at", null);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

export type CategoryWithCount = Category & { listing_count_live: number };

export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: categories }, counts] = await Promise.all([
    admin.from("categories").select("*").order("sort_order", { ascending: true }),
    categoryCounts(admin),
  ]);
  return (categories ?? []).map((c) => ({
    ...c,
    listing_count_live: counts.get(c.id) ?? 0,
  }));
}

export type TagGroupWithMeta = TagGroup & {
  category_name: string | null;
  tag_count: number;
};

export async function getTagGroups(): Promise<TagGroupWithMeta[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: groups }, { data: categories }, { data: tags }] = await Promise.all([
    admin.from("tag_groups").select("*").order("sort_order", { ascending: true }),
    admin.from("categories").select("id, name"),
    admin.from("tags").select("group_id"),
  ]);
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const tagCount = new Map<string, number>();
  for (const t of tags ?? []) tagCount.set(t.group_id, (tagCount.get(t.group_id) ?? 0) + 1);

  return (groups ?? []).map((g) => ({
    ...g,
    category_name: g.category_id ? catName.get(g.category_id) ?? null : null,
    tag_count: tagCount.get(g.id) ?? 0,
  }));
}

export type TagWithCount = Tag & { listing_count: number };

/** All tags grouped by group_id, each with its live listing count. */
export async function getTagsByGroup(): Promise<Map<string, TagWithCount[]>> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: tags }, { data: listingTags }] = await Promise.all([
    admin.from("tags").select("*").order("sort_order", { ascending: true }),
    admin.from("listing_tags").select("tag_id"),
  ]);
  const counts = new Map<string, number>();
  for (const lt of listingTags ?? []) counts.set(lt.tag_id, (counts.get(lt.tag_id) ?? 0) + 1);

  const byGroup = new Map<string, TagWithCount[]>();
  for (const t of tags ?? []) {
    const list = byGroup.get(t.group_id) ?? [];
    list.push({ ...t, listing_count: counts.get(t.id) ?? 0 });
    byGroup.set(t.group_id, list);
  }
  return byGroup;
}

export async function getCategoryLookups(): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("categories")
    .select("id, name")
    .order("name");
  return data ?? [];
}
