"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { slugify } from "@/lib/utils/slug";
import type { TablesUpdate } from "@/types";
import type { AdminActionResult } from "./users-actions";

const idSchema = z.string().uuid();

/** Taxonomy changes flow to the public surfaces with no deploy — revalidate them. */
function revalidatePublic() {
  revalidatePath("/"); // directory + filter rail
  revalidatePath("/list-a-program"); // listing form
  revalidatePath("/admin/taxonomy");
}

/* =========================================================== categories === */

const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  slug: z.string().trim().max(80).optional(),
  icon: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  ages_label: z.string().trim().min(1).max(60).default("Ages / grades"),
  rate_label: z.string().trim().min(1).max(60).default("Rate"),
  is_active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export async function createCategoryAction(input: CategoryInput): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: max } = await admin
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await admin
    .from("categories")
    .insert({
      name: d.name,
      slug: d.slug?.trim() || slugify(d.name),
      icon: d.icon ?? null,
      description: d.description ?? null,
      ages_label: d.ages_label,
      rate_label: d.rate_label,
      is_active: d.is_active,
      sort_order: (max?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !created) {
    return {
      ok: false,
      error: error?.code === "23505" ? "That slug already exists." : "Couldn't create the category.",
    };
  }
  await logAudit({ action: "category.create", entityType: "category", entityId: created.id, after: { name: d.name } });
  revalidatePublic();
  return { ok: true, message: "Category created." };
}

export async function updateCategoryAction(id: string, input: CategoryInput): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid category." };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: before } = await admin.from("categories").select("slug, name").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "That category no longer exists." };

  const { error } = await admin
    .from("categories")
    .update({
      name: d.name,
      slug: d.slug?.trim() || before.slug,
      icon: d.icon ?? null,
      description: d.description ?? null,
      ages_label: d.ages_label,
      rate_label: d.rate_label,
      is_active: d.is_active,
    })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That slug already exists." : "Couldn't save the category." };
  }
  await logAudit({
    action: "category.update",
    entityType: "category",
    entityId: id,
    before: { slug: before.slug },
    after: { slug: d.slug?.trim() || before.slug },
  });
  revalidatePublic();
  return { ok: true, message: "Category saved." };
}

export async function reorderCategoriesAction(ids: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(idSchema).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(parsed.data.map((id, i) => admin.from("categories").update({ sort_order: i }).eq("id", id)));
  await logAudit({ action: "category.reorder", entityType: "category" });
  revalidatePublic();
  return { ok: true };
}

async function liveCategoryCount(admin: ReturnType<typeof createAdminClient>, id: string): Promise<number> {
  const { count } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("deleted_at", null);
  return count ?? 0;
}

export async function deleteCategoryAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid category." };
  const admin = createAdminClient();

  const count = await liveCategoryCount(admin, id);
  if (count > 0) {
    return {
      ok: false,
      error: `${count} listing${count === 1 ? "" : "s"} use this category. Move them to another category first.`,
    };
  }
  const { data: cat } = await admin.from("categories").select("name").eq("id", id).maybeSingle();
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) {
    return { ok: false, error: "Something still references this category. Reassign it first." };
  }
  await logAudit({ action: "category.delete", entityType: "category", entityId: id, meta: { name: cat?.name } });
  revalidatePublic();
  return { ok: true, message: `${cat?.name ?? "Category"} deleted.` };
}

export async function moveCategoryListingsAction(fromId: string, toId: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(fromId).success || !idSchema.safeParse(toId).success) {
    return { ok: false, error: "Invalid categories." };
  }
  if (fromId === toId) return { ok: false, error: "Pick a different destination category." };
  const admin = createAdminClient();

  const { data: dest } = await admin.from("categories").select("id").eq("id", toId).maybeSingle();
  if (!dest) return { ok: false, error: "That destination category no longer exists." };

  const count = await liveCategoryCount(admin, fromId);
  const { error } = await admin
    .from("listings")
    .update({ category_id: toId })
    .eq("category_id", fromId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Couldn't move those listings." };

  await logAudit({
    action: "category.move_listings",
    entityType: "category",
    entityId: fromId,
    meta: { to: toId, count },
  });
  revalidatePublic();
  return { ok: true, message: `Moved ${count} listing${count === 1 ? "" : "s"}.` };
}

/* =========================================================== tag groups === */

const groupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  category_id: z.string().uuid().nullable().default(null),
  selection_type: z.enum(["single", "multi"]).default("multi"),
  show_in_form: z.boolean().default(true),
  show_in_filter: z.boolean().default(true),
  show_on_listing: z.boolean().default(true),
  sort_mode: z.enum(["alphabetical", "manual"]).default("alphabetical"),
  is_active: z.boolean().default(true),
});
export type TagGroupInput = z.infer<typeof groupSchema>;

export async function createTagGroupAction(input: TagGroupInput): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: max } = await admin
    .from("tag_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await admin
    .from("tag_groups")
    .insert({
      name: d.name,
      slug: d.slug?.trim() || slugify(d.name),
      description: d.description ?? null,
      category_id: d.category_id,
      selection_type: d.selection_type,
      show_in_form: d.show_in_form,
      show_in_filter: d.show_in_filter,
      show_on_listing: d.show_on_listing,
      sort_mode: d.sort_mode,
      is_active: d.is_active,
      sort_order: (max?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: error?.code === "23505" ? "That slug already exists." : "Couldn't create the group." };
  }
  await logAudit({ action: "tag_group.create", entityType: "tag_group", entityId: created.id, after: { name: d.name } });
  revalidatePublic();
  return { ok: true, message: "Group created." };
}

export async function updateTagGroupAction(id: string, input: TagGroupInput): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid group." };
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: before } = await admin.from("tag_groups").select("slug").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "That group no longer exists." };

  const { error } = await admin
    .from("tag_groups")
    .update({
      name: d.name,
      slug: d.slug?.trim() || before.slug,
      description: d.description ?? null,
      category_id: d.category_id,
      selection_type: d.selection_type,
      show_in_form: d.show_in_form,
      show_in_filter: d.show_in_filter,
      show_on_listing: d.show_on_listing,
      sort_mode: d.sort_mode,
      is_active: d.is_active,
    })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That slug already exists." : "Couldn't save the group." };
  }
  await logAudit({ action: "tag_group.update", entityType: "tag_group", entityId: id });
  revalidatePublic();
  return { ok: true, message: "Group saved." };
}

export async function toggleGroupFlagAction(
  id: string,
  flag: "show_in_form" | "show_in_filter" | "show_on_listing" | "is_active",
  value: boolean,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid group." };
  if (!["show_in_form", "show_in_filter", "show_on_listing", "is_active"].includes(flag)) {
    return { ok: false, error: "Invalid flag." };
  }
  const admin = createAdminClient();
  const patch = { [flag]: value } as TablesUpdate<"tag_groups">;
  const { error } = await admin.from("tag_groups").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update that." };
  await logAudit({ action: "tag_group.toggle", entityType: "tag_group", entityId: id, meta: { flag, value } });
  revalidatePublic();
  return { ok: true };
}

export async function reorderTagGroupsAction(ids: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(idSchema).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(parsed.data.map((id, i) => admin.from("tag_groups").update({ sort_order: i }).eq("id", id)));
  await logAudit({ action: "tag_group.reorder", entityType: "tag_group" });
  revalidatePublic();
  return { ok: true };
}

export async function deleteTagGroupAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid group." };
  const admin = createAdminClient();

  const { data: tags } = await admin.from("tags").select("id").eq("group_id", id);
  const tagIds = (tags ?? []).map((t) => t.id);
  if (tagIds.length) {
    const { count } = await admin
      .from("listing_tags")
      .select("tag_id", { count: "exact", head: true })
      .in("tag_id", tagIds);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Tags in this group are used by ${count} listing${count === 1 ? "" : "s"}. Reassign or merge them first.`,
      };
    }
    await admin.from("tags").delete().in("id", tagIds);
  }
  const { data: g } = await admin.from("tag_groups").select("name").eq("id", id).maybeSingle();
  const { error } = await admin.from("tag_groups").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete that group." };

  await logAudit({ action: "tag_group.delete", entityType: "tag_group", entityId: id, meta: { name: g?.name } });
  revalidatePublic();
  return { ok: true, message: `${g?.name ?? "Group"} deleted.` };
}

/* ================================================================= tags === */

async function nextTagOrder(admin: ReturnType<typeof createAdminClient>, groupId: string): Promise<number> {
  const { data } = await admin
    .from("tags")
    .select("sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function createTagAction(groupId: string, name: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(groupId).success) return { ok: false, error: "Invalid group." };
  const nameOk = z.string().trim().min(1).max(80).safeParse(name);
  if (!nameOk.success) return { ok: false, error: "Enter a tag name." };
  const admin = createAdminClient();

  const { error } = await admin.from("tags").insert({
    group_id: groupId,
    name: nameOk.data,
    slug: slugify(nameOk.data) || nameOk.data.toLowerCase(),
    sort_order: await nextTagOrder(admin, groupId),
    is_active: true,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That tag already exists in this group." : "Couldn't add the tag." };
  }
  await logAudit({ action: "tag.create", entityType: "tag", meta: { group: groupId, name: nameOk.data } });
  revalidatePublic();
  return { ok: true, message: "Tag added." };
}

export async function bulkCreateTagsAction(groupId: string, text: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(groupId).success) return { ok: false, error: "Invalid group." };
  const admin = createAdminClient();

  const names = Array.from(
    new Set(
      text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 300),
    ),
  );
  if (!names.length) return { ok: false, error: "Paste at least one value." };

  const { data: existing } = await admin.from("tags").select("slug").eq("group_id", groupId);
  const have = new Set((existing ?? []).map((t) => t.slug));

  let order = await nextTagOrder(admin, groupId);
  const rows: { group_id: string; name: string; slug: string; sort_order: number; is_active: boolean }[] = [];
  for (const name of names) {
    const slug = slugify(name) || name.toLowerCase();
    if (have.has(slug)) continue;
    have.add(slug);
    rows.push({ group_id: groupId, name, slug, sort_order: order++, is_active: true });
  }
  if (!rows.length) return { ok: false, error: "Those all exist already." };

  const { error } = await admin.from("tags").insert(rows);
  if (error) return { ok: false, error: "Couldn't add those tags." };

  await logAudit({ action: "tag.bulk_create", entityType: "tag", meta: { group: groupId, added: rows.length } });
  revalidatePublic();
  return { ok: true, message: `Added ${rows.length} tag${rows.length === 1 ? "" : "s"}.` };
}

export async function renameTagAction(id: string, name: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid tag." };
  const nameOk = z.string().trim().min(1).max(80).safeParse(name);
  if (!nameOk.success) return { ok: false, error: "Enter a name." };
  const admin = createAdminClient();
  // Keep the slug stable so any shared filter URLs don't break.
  const { error } = await admin.from("tags").update({ name: nameOk.data }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't rename the tag." };
  await logAudit({ action: "tag.rename", entityType: "tag", entityId: id, after: { name: nameOk.data } });
  revalidatePublic();
  return { ok: true };
}

export async function toggleTagActiveAction(id: string, value: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid tag." };
  const admin = createAdminClient();
  const { error } = await admin.from("tags").update({ is_active: value }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update that tag." };
  await logAudit({ action: "tag.toggle", entityType: "tag", entityId: id, meta: { active: value } });
  revalidatePublic();
  return { ok: true };
}

export async function reorderTagsAction(ids: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(idSchema).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(parsed.data.map((id, i) => admin.from("tags").update({ sort_order: i }).eq("id", id)));
  await logAudit({ action: "tag.reorder", entityType: "tag" });
  revalidatePublic();
  return { ok: true };
}

export async function deleteTagAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid tag." };
  const admin = createAdminClient();
  // Remove listing associations first (FK), then the tag.
  await admin.from("listing_tags").delete().eq("tag_id", id);
  const { data: t } = await admin.from("tags").select("name").eq("id", id).maybeSingle();
  const { error } = await admin.from("tags").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete that tag." };
  await logAudit({ action: "tag.delete", entityType: "tag", entityId: id, meta: { name: t?.name } });
  revalidatePublic();
  return { ok: true, message: `${t?.name ?? "Tag"} deleted.` };
}

export async function mergeTagsAction(sourceId: string, targetId: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(sourceId).success || !idSchema.safeParse(targetId).success) {
    return { ok: false, error: "Invalid tags." };
  }
  if (sourceId === targetId) return { ok: false, error: "Pick two different tags." };
  const admin = createAdminClient();

  // listing_tags has a composite (listing_id, tag_id) key and no id column.
  // Listings already on the target would collide, so drop those source rows and
  // move the rest onto the target tag.
  const { data: onTarget } = await admin.from("listing_tags").select("listing_id").eq("tag_id", targetId);
  const targetSet = new Set((onTarget ?? []).map((r) => r.listing_id));
  const { data: sourceRows } = await admin.from("listing_tags").select("listing_id").eq("tag_id", sourceId);
  const dupListingIds = (sourceRows ?? [])
    .map((r) => r.listing_id)
    .filter((lid) => targetSet.has(lid));
  if (dupListingIds.length) {
    await admin.from("listing_tags").delete().eq("tag_id", sourceId).in("listing_id", dupListingIds);
  }
  await admin.from("listing_tags").update({ tag_id: targetId }).eq("tag_id", sourceId);

  const moved = (sourceRows ?? []).length - dupListingIds.length;
  const { error } = await admin.from("tags").delete().eq("id", sourceId);
  if (error) return { ok: false, error: "Merged the listings but couldn't remove the old tag." };

  await logAudit({
    action: "tag.merge",
    entityType: "tag",
    entityId: targetId,
    meta: { source: sourceId, moved },
  });
  revalidatePublic();
  return { ok: true, message: `Merged — moved ${moved} listing${moved === 1 ? "" : "s"}.` };
}
