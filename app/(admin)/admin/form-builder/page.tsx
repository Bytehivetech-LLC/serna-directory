import type { Metadata } from "next";
import { getFormBuilderData } from "@/lib/admin/form-builder-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { FormBuilder } from "@/components/admin/form-builder/form-builder";

export const metadata: Metadata = { title: "Form builder" };

export default async function FormBuilderPage() {
  const { sections, fields, categories } = await getFormBuilderData();

  return (
    <div className="space-y-6">
      <PageHeading
        title="Form builder"
        lede="Shape the listing form. Core fields (locked) map to real columns; everything else is yours to change. Changes go live with no deploy."
      />
      <FormBuilder sections={sections} fields={fields} categories={categories} />
    </div>
  );
}
