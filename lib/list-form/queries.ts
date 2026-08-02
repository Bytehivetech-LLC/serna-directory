import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  CategoryOption,
  FieldOption,
  FieldType,
  FormField,
  FormPackage,
  FormSection,
  FormTagGroup,
  ListFormConfig,
} from "./types";

function parseOptions(value: unknown): FieldOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((o) =>
      o && typeof o === "object"
        ? {
            label: String((o as Record<string, unknown>).label ?? ""),
            value: String((o as Record<string, unknown>).value ?? ""),
          }
        : null,
    )
    .filter((o): o is FieldOption => Boolean(o && o.value));
}

function parseFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

/** Everything the listing form needs: sections, fields, categories, tag groups, packages. */
export const getListFormConfig = cache(async (): Promise<ListFormConfig> => {
  const supabase = await createClient();

  const [
    sectionsRes,
    fieldsRes,
    categoriesRes,
    tagGroupsRes,
    tagsRes,
    packagesRes,
    addonsRes,
  ] = await Promise.all([
      supabase
        .from("form_sections")
        .select("id, key, title, subtitle, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("form_fields")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("categories")
        .select("id, name, slug, ages_label, rate_label")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("tag_groups")
        .select("id, name, slug, category_id, sort_order")
        .eq("show_in_form", true)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("tags")
        .select("id, name, slug, group_id")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("sort_order"),
      supabase
        .from("addons")
        .select(
          "id, slug, name, short_description, description, price_cents, currency, interval, max_quantity, package_ids, badge_label, image_url",
        )
        .eq("is_active", true)
        .eq("is_public", true)
        .order("sort_order"),
    ]);

  const sectionKeyById = new Map(
    (sectionsRes.data ?? []).map((s) => [s.id, s.key]),
  );

  const fields: FormField[] = (fieldsRes.data ?? []).map((f) => ({
    id: f.id,
    sectionKey: (f.section_id && sectionKeyById.get(f.section_id)) || "",
    key: f.key,
    label: f.label,
    helpText: f.help_text,
    placeholder: f.placeholder,
    type: (f.field_type as FieldType) ?? "text",
    options: parseOptions(f.options),
    isRequired: Boolean(f.is_required),
    isCore: Boolean(f.is_core),
    columnName: f.column_name,
    maxLength: f.max_length,
    strengthPoints: f.strength_points ?? 0,
    sortOrder: f.sort_order ?? 0,
  }));

  const sections: FormSection[] = (sectionsRes.data ?? []).map((s) => ({
    id: s.id,
    key: s.key,
    title: s.title,
    subtitle: s.subtitle,
    sortOrder: s.sort_order ?? 0,
    fields: fields
      .filter((f) => f.sectionKey === s.key)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const categories: CategoryOption[] = (categoriesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    agesLabel: c.ages_label,
    rateLabel: c.rate_label,
  }));

  const tagsByGroup = new Map<string, { id: string; name: string; slug: string }[]>();
  for (const t of tagsRes.data ?? []) {
    const list = tagsByGroup.get(t.group_id) ?? [];
    list.push({ id: t.id, name: t.name, slug: t.slug });
    tagsByGroup.set(t.group_id, list);
  }

  const tagGroups: FormTagGroup[] = (tagGroupsRes.data ?? [])
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      categoryId: g.category_id,
      sortOrder: g.sort_order ?? 0,
      tags: (tagsByGroup.get(g.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }))
    .filter((g) => g.tags.length > 0);

  const packages: FormPackage[] = (packagesRes.data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    priceCents: p.price_cents ?? 0,
    interval: p.interval ?? "year",
    maxImages: p.max_images ?? 8,
    allowsFeatured: Boolean(p.allows_featured),
    requiresApproval: Boolean(p.requires_approval),
    features: parseFeatures(p.features),
    badgeLabel: p.badge_label,
    isDefault: Boolean(p.is_default),
    sortOrder: p.sort_order ?? 0,
  }));

  const addons = (addonsRes.data ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    shortDescription: a.short_description,
    description: a.description,
    priceCents: a.price_cents ?? 0,
    currency: a.currency ?? "usd",
    interval: a.interval ?? "one_time",
    maxQuantity: a.max_quantity ?? 1,
    packageIds: Array.isArray(a.package_ids) ? a.package_ids : [],
    badgeLabel: a.badge_label,
    imageUrl: a.image_url,
  }));

  const maxFieldPoints = fields.reduce((sum, f) => sum + f.strengthPoints, 0);

  return { sections, categories, tagGroups, packages, addons, maxFieldPoints };
});
