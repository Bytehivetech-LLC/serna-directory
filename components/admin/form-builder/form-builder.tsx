"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Lock, MoreHorizontal, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { FormSection, FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createSectionAction,
  updateSectionAction,
  reorderSectionsAction,
  deleteSectionAction,
  createFieldAction,
  updateFieldAction,
  reorderFieldsAction,
  moveFieldAction,
  deleteFieldAction,
} from "@/lib/admin/form-builder-actions";
import { FormPreview } from "./form-preview";
import { FieldEditorDialog } from "./field-editor-dialog";
import { SectionDialog } from "./section-dialog";

export function FormBuilder({
  sections: initialSections,
  fields: initialFields,
  categories,
}: {
  sections: FormSection[];
  fields: FormField[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sections, setSections] = useState(initialSections);
  const [fields, setFields] = useState(initialFields);
  const [previewCat, setPreviewCat] = useState<string | null>(null);
  const [fieldDialog, setFieldDialog] = useState<
    { mode: "create"; sectionId: string } | { mode: "edit"; field: FormField } | null
  >(null);
  const [sectionDialog, setSectionDialog] = useState<
    { mode: "create" } | { mode: "edit"; section: FormSection } | null
  >(null);

  useEffect(() => {
    setSections(initialSections);
    setFields(initialFields);
  }, [initialSections, initialFields]);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, silent = false) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (!silent && res.message) toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
        router.refresh();
      }
    });
  }

  function moveSection(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= sections.length) return;
    const next = [...sections];
    [next[i], next[t]] = [next[t], next[i]];
    setSections(next);
    run(() => reorderSectionsAction(next.map((s) => s.id)), true);
  }
  function moveField(sectionFields: FormField[], i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= sectionFields.length) return;
    const reordered = [...sectionFields];
    [reordered[i], reordered[t]] = [reordered[t], reordered[i]];
    // Optimistic local reorder within the section.
    const others = fields.filter((f) => f.section_id !== sectionFields[0].section_id);
    setFields([...others, ...reordered]);
    run(() => reorderFieldsAction(reordered.map((f) => f.id)), true);
  }

  const catName = previewCat ? categories.find((c) => c.id === previewCat)?.name ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Left: editor */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setSectionDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" /> Add section
          </Button>
        </div>

        {sections
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((section, si, arr) => {
            const sectionFields = fields
              .filter((f) => f.section_id === section.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={section.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move section up" disabled={si === 0 || pending} onClick={() => moveSection(si, -1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Move section down" disabled={si === arr.length - 1 || pending} onClick={() => moveSection(si, 1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <button className="font-display text-sm font-bold text-ink hover:text-indigo" onClick={() => setSectionDialog({ mode: "edit", section })}>
                          {section.title}
                        </button>
                        {!section.is_active ? <Badge variant="outline">Hidden</Badge> : null}
                      </div>
                      {section.subtitle ? <p className="text-xs text-muted-foreground">{section.subtitle}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setFieldDialog({ mode: "create", sectionId: section.id })}>
                      <Plus className="h-4 w-4" /> Field
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Section actions"><Settings2 className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setSectionDialog({ mode: "edit", section })}>Edit section</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger" onSelect={(e) => { e.preventDefault(); run(() => deleteSectionAction(section.id)); }}>Delete section</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {sectionFields.map((field, fi) => (
                    <li key={field.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button type="button" aria-label="Move field up" disabled={fi === 0 || pending} onClick={() => moveField(sectionFields, fi, -1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                          <button type="button" aria-label="Move field down" disabled={fi === sectionFields.length - 1 || pending} onClick={() => moveField(sectionFields, fi, 1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                        </div>
                        <button className="text-left text-sm font-semibold text-ink hover:text-indigo" onClick={() => setFieldDialog({ mode: "edit", field })}>
                          {field.label}
                        </button>
                        {field.is_core ? (
                          <span title="Core field — maps to a database column. You can relabel and reorder it, but not delete it or change its type." className="text-faint">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        <span className="text-xs text-faint">{field.field_type}</span>
                        {!field.is_active ? <Badge variant="outline">Off</Badge> : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Field actions"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setFieldDialog({ mode: "edit", field })}>Edit</DropdownMenuItem>
                          {sections.filter((s) => s.id !== section.id).length ? (
                            <>
                              <DropdownMenuSeparator />
                              {sections.filter((s) => s.id !== section.id).map((s) => (
                                <DropdownMenuItem key={s.id} onSelect={() => run(() => moveFieldAction(field.id, s.id))}>
                                  Move to “{s.title}”
                                </DropdownMenuItem>
                              ))}
                            </>
                          ) : null}
                          {!field.is_core ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-danger" onSelect={() => run(() => deleteFieldAction(field.id))}>
                                Delete
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                  {sectionFields.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-muted-foreground">No fields yet.</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
      </div>

      {/* Right: live preview */}
      <div className="space-y-3 xl:sticky xl:top-6 xl:h-fit">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-ink">Preview as</label>
          <select
            value={previewCat ?? ""}
            onChange={(e) => setPreviewCat(e.target.value || null)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
          >
            <option value="">Any category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <FormPreview sections={sections} fields={fields} categoryId={previewCat} categoryName={catName} />
      </div>

      {fieldDialog ? (
        <FieldEditorDialog
          dialog={fieldDialog}
          categories={categories}
          onClose={() => setFieldDialog(null)}
          onSaved={() => { setFieldDialog(null); router.refresh(); }}
          save={async (input) =>
            fieldDialog.mode === "edit"
              ? updateFieldAction(fieldDialog.field.id, input)
              : createFieldAction(input)
          }
        />
      ) : null}

      {sectionDialog ? (
        <SectionDialog
          dialog={sectionDialog}
          onClose={() => setSectionDialog(null)}
          onSaved={() => { setSectionDialog(null); router.refresh(); }}
          save={async (input) =>
            sectionDialog.mode === "edit"
              ? updateSectionAction(sectionDialog.section.id, input)
              : createSectionAction(input)
          }
        />
      ) : null}
    </div>
  );
}
