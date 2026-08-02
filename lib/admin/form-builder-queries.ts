import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { FormSection, FormField } from "@/types";

export type BuilderSection = FormSection;
export type BuilderField = FormField;

export type FormBuilderData = {
  sections: BuilderSection[];
  fields: BuilderField[];
  categories: { id: string; name: string }[];
};

export async function getFormBuilderData(): Promise<FormBuilderData> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: sections }, { data: fields }, { data: categories }] = await Promise.all([
    admin.from("form_sections").select("*").order("sort_order", { ascending: true }),
    admin.from("form_fields").select("*").order("sort_order", { ascending: true }),
    admin.from("categories").select("id, name").order("name"),
  ]);
  return {
    sections: sections ?? [],
    fields: fields ?? [],
    categories: categories ?? [],
  };
}

/** How many listings currently hold data for a custom field key (delete warning). */
export async function countCustomFieldUsage(key: string): Promise<number> {
  await requireAdmin();
  const admin = createAdminClient();
  const { count } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .not(`custom_fields->>${key}`, "is", null);
  return count ?? 0;
}
