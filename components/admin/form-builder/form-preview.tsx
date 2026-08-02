"use client";

import type { FormSection, FormField } from "@/types";
import { SectionCard } from "@/components/layout/section-card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Option = { label: string; value: string };

function options(field: FormField): Option[] {
  const raw = field.options;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) =>
      o && typeof o === "object"
        ? { label: String((o as Record<string, unknown>).label ?? ""), value: String((o as Record<string, unknown>).value ?? "") }
        : null,
    )
    .filter((o): o is Option => Boolean(o && o.value));
}

function PreviewField({ field }: { field: FormField }) {
  const t = field.field_type;
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">
        {field.label}
        {field.is_required ? <span className="text-danger">*</span> : null}
      </Label>
      {t === "textarea" ? (
        <Textarea rows={2} disabled placeholder={field.placeholder ?? ""} />
      ) : t === "select" ? (
        <select disabled className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground">
          <option>{field.placeholder || "Choose…"}</option>
          {options(field).map((o) => <option key={o.value}>{o.label}</option>)}
        </select>
      ) : t === "radio" || t === "multiselect" || t === "checkbox" ? (
        <div className="flex flex-wrap gap-2">
          {(options(field).length ? options(field) : [{ label: field.label, value: "1" }]).map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground">
              <span className={`h-3.5 w-3.5 border border-border-strong ${t === "radio" ? "rounded-full" : "rounded"}`} />
              {o.label}
            </span>
          ))}
        </div>
      ) : (
        <Input
          disabled
          placeholder={field.placeholder ?? ""}
          type={t === "email" ? "email" : t === "url" ? "url" : t === "tel" ? "tel" : t === "number" ? "number" : t === "date" ? "date" : "text"}
        />
      )}
      {field.help_text ? <p className="text-xs text-muted-foreground">{field.help_text}</p> : null}
    </div>
  );
}

export function FormPreview({
  sections,
  fields,
  categoryId,
  categoryName,
}: {
  sections: FormSection[];
  fields: FormField[];
  categoryId: string | null;
  categoryName: string | null;
}) {
  const activeSections = sections.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-violet/30 bg-violet-soft px-4 py-2.5 text-sm text-indigo-deep">
        Previewing as <b className="text-ink">{categoryName ?? "any category"}</b>. This is what an applicant sees.
      </div>
      {activeSections.map((section) => {
        const sectionFields = fields
          .filter((f) => f.section_id === section.id && f.is_active)
          .filter((f) => f.category_id == null || f.category_id === categoryId)
          .sort((a, b) => a.sort_order - b.sort_order);
        if (!sectionFields.length) return null;
        return (
          <SectionCard key={section.id} title={section.title} description={section.subtitle ?? undefined}>
            <div className="space-y-4">
              {sectionFields.map((f) => <PreviewField key={f.id} field={f} />)}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
