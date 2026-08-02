"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { slugify } from "@/lib/utils/slug";
import { revalidateWeb } from "@/lib/admin/revalidate-web";
import { countCustomFieldUsage } from "./form-builder-queries";
import type { AdminActionResult } from "./users-actions";

const idSchema = z.string().uuid();

async function revalidateForm() {
  revalidatePath("/list-a-program");
  revalidatePath("/admin/form-builder");
  // Bridge to the separate public deployment (no-op on single-deployment dev).
  await revalidateWeb({ paths: ["/list-a-program"] });
}

/* ============================================================= sections === */

const sectionSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120),
  subtitle: z.string().trim().max(300).optional().nullable(),
  is_active: z.boolean().default(true),
});
export type SectionInput = z.infer<typeof sectionSchema>;

export async function createSectionAction(input: SectionInput): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: max } = await admin
    .from("form_sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const key = `${slugify(d.title) || "section"}-${crypto.randomUUID().slice(0, 4)}`;
  const { error } = await admin.from("form_sections").insert({
    key,
    title: d.title,
    subtitle: d.subtitle ?? null,
    is_active: d.is_active,
    sort_order: (max?.sort_order ?? -1) + 1,
  });
  if (error) return { ok: false, error: "Couldn't create the section." };
  await logAudit({ action: "form_section.create", entityType: "form_section", meta: { title: d.title } });
  await revalidateForm();
  return { ok: true, message: "Section added." };
}

export async function updateSectionAction(id: string, input: SectionInput): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid section." };
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin
    .from("form_sections")
    .update({ title: d.title, subtitle: d.subtitle ?? null, is_active: d.is_active })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the section." };
  await logAudit({ action: "form_section.update", entityType: "form_section", entityId: id });
  await revalidateForm();
  return { ok: true, message: "Section saved." };
}

export async function reorderSectionsAction(ids: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(idSchema).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(parsed.data.map((id, i) => admin.from("form_sections").update({ sort_order: i }).eq("id", id)));
  await logAudit({ action: "form_section.reorder", entityType: "form_section" });
  await revalidateForm();
  return { ok: true };
}

export async function deleteSectionAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid section." };
  const admin = createAdminClient();
  const { count } = await admin
    .from("form_fields")
    .select("id", { count: "exact", head: true })
    .eq("section_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: `Move or delete this section's ${count} field${count === 1 ? "" : "s"} first.` };
  }
  const { error } = await admin.from("form_sections").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the section." };
  await logAudit({ action: "form_section.delete", entityType: "form_section", entityId: id });
  await revalidateForm();
  return { ok: true, message: "Section deleted." };
}

/* =============================================================== fields === */

const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "url",
  "tel",
  "number",
  "select",
  "multiselect",
  "checkbox",
  "radio",
  "date",
] as const;

const optionSchema = z.object({ label: z.string().trim().max(120), value: z.string().trim().max(120) });

const fieldSchema = z.object({
  section_id: z.string().uuid(),
  label: z.string().trim().min(1, "Label is required.").max(160),
  help_text: z.string().trim().max(300).optional().nullable(),
  placeholder: z.string().trim().max(160).optional().nullable(),
  field_type: z.enum(FIELD_TYPES),
  options: z.array(optionSchema).max(60).default([]),
  is_required: z.boolean().default(false),
  max_length: z.number().int().min(0).max(10000).nullable().default(null),
  strength_points: z.number().int().min(0).max(100).default(0),
  show_on_public: z.boolean().default(true),
  category_id: z.string().uuid().nullable().default(null),
  is_active: z.boolean().default(true),
});
export type FieldInput = z.infer<typeof fieldSchema>;

export async function createFieldAction(input: FieldInput): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: max } = await admin
    .from("form_fields")
    .select("sort_order")
    .eq("section_id", d.section_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const key = `custom_${slugify(d.label).replace(/-/g, "_") || "field"}_${crypto.randomUUID().slice(0, 4)}`;
  const { error } = await admin.from("form_fields").insert({
    section_id: d.section_id,
    category_id: d.category_id,
    key,
    label: d.label,
    help_text: d.help_text ?? null,
    placeholder: d.placeholder ?? null,
    field_type: d.field_type,
    options: d.options,
    is_required: d.is_required,
    is_core: false,
    column_name: null,
    show_on_public: d.show_on_public,
    max_length: d.max_length,
    strength_points: d.strength_points,
    sort_order: (max?.sort_order ?? -1) + 1,
    is_active: d.is_active,
  });
  if (error) return { ok: false, error: "Couldn't create the field." };
  await logAudit({ action: "form_field.create", entityType: "form_field", meta: { label: d.label } });
  await revalidateForm();
  return { ok: true, message: "Field added." };
}

export async function updateFieldAction(id: string, input: FieldInput): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid field." };
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("form_fields")
    .select("is_core, field_type")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "That field no longer exists." };

  // Core fields map to real columns: relabel/reorder/help/required only — never
  // change the type.
  const patch = {
    label: d.label,
    help_text: d.help_text ?? null,
    placeholder: d.placeholder ?? null,
    field_type: before.is_core ? before.field_type : d.field_type,
    options: d.options,
    is_required: d.is_required,
    show_on_public: d.show_on_public,
    max_length: d.max_length,
    strength_points: d.strength_points,
    category_id: d.category_id,
    is_active: d.is_active,
    ...(before.is_core ? {} : { section_id: d.section_id }),
  };
  const { error } = await admin.from("form_fields").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the field." };
  await logAudit({ action: "form_field.update", entityType: "form_field", entityId: id, after: { label: d.label } });
  await revalidateForm();
  return { ok: true, message: "Field saved." };
}

export async function reorderFieldsAction(ids: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(idSchema).min(1).max(300).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(parsed.data.map((id, i) => admin.from("form_fields").update({ sort_order: i }).eq("id", id)));
  await logAudit({ action: "form_field.reorder", entityType: "form_field" });
  await revalidateForm();
  return { ok: true };
}

export async function moveFieldAction(id: string, toSectionId: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(toSectionId).success) {
    return { ok: false, error: "Invalid move." };
  }
  const admin = createAdminClient();
  const { data: max } = await admin
    .from("form_fields")
    .select("sort_order")
    .eq("section_id", toSectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin
    .from("form_fields")
    .update({ section_id: toSectionId, sort_order: (max?.sort_order ?? -1) + 1 })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't move the field." };
  await logAudit({ action: "form_field.move", entityType: "form_field", entityId: id, meta: { to: toSectionId } });
  await revalidateForm();
  return { ok: true, message: "Field moved." };
}

export async function deleteFieldAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid field." };
  const admin = createAdminClient();

  const { data: field } = await admin.from("form_fields").select("is_core, label").eq("id", id).maybeSingle();
  if (!field) return { ok: false, error: "That field no longer exists." };
  if (field.is_core) {
    return { ok: false, error: "Core fields map to database columns and can't be deleted." };
  }
  // Only the form_field definition is removed — any values already saved stay in
  // each listing's custom_fields JSON.
  const { error } = await admin.from("form_fields").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the field." };
  await logAudit({ action: "form_field.delete", entityType: "form_field", entityId: id, meta: { label: field.label } });
  await revalidateForm();
  return { ok: true, message: "Field deleted (saved data kept)." };
}

/** For the delete-warning dialog. */
export async function fieldUsageAction(key: string): Promise<{ count: number }> {
  await requireAdmin();
  if (!key) return { count: 0 };
  return { count: await countCustomFieldUsage(key) };
}
