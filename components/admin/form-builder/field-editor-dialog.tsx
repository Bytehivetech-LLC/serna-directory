"use client";

import { useState, useTransition } from "react";
import { Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FieldInput } from "@/lib/admin/form-builder-actions";

const TYPES = ["text", "textarea", "email", "url", "tel", "number", "select", "multiselect", "checkbox", "radio", "date"] as const;
const CHOICE = new Set(["select", "multiselect", "radio", "checkbox"]);

type Option = { label: string; value: string };
type Dialog =
  | { mode: "create"; sectionId: string }
  | { mode: "edit"; field: FormField };

function readOptions(field: FormField | null): Option[] {
  if (!field || !Array.isArray(field.options)) return [];
  return field.options
    .map((o) => (o && typeof o === "object" ? { label: String((o as Record<string, unknown>).label ?? ""), value: String((o as Record<string, unknown>).value ?? "") } : null))
    .filter((o): o is Option => Boolean(o && o.value));
}

export function FieldEditorDialog({
  dialog,
  categories,
  onClose,
  onSaved,
  save,
}: {
  dialog: Dialog;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  save: (input: FieldInput) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const field = dialog.mode === "edit" ? dialog.field : null;
  const isCore = Boolean(field?.is_core);
  const sectionId = dialog.mode === "create" ? dialog.sectionId : field!.section_id!;
  const [pending, startTransition] = useTransition();

  const [f, setF] = useState({
    label: field?.label ?? "",
    help_text: field?.help_text ?? "",
    placeholder: field?.placeholder ?? "",
    field_type: field?.field_type ?? "text",
    is_required: field?.is_required ?? false,
    max_length: field?.max_length == null ? "" : String(field.max_length),
    strength_points: String(field?.strength_points ?? 0),
    show_on_public: field?.show_on_public ?? true,
    category_id: field?.category_id ?? "",
    is_active: field?.is_active ?? true,
  });
  const [opts, setOpts] = useState<Option[]>(readOptions(field));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    const input: FieldInput = {
      section_id: sectionId,
      label: f.label.trim(),
      help_text: f.help_text.trim() || null,
      placeholder: f.placeholder.trim() || null,
      field_type: f.field_type as FieldInput["field_type"],
      options: CHOICE.has(f.field_type) ? opts.filter((o) => o.value.trim()) : [],
      is_required: f.is_required,
      max_length: f.max_length.trim() === "" ? null : Number(f.max_length),
      strength_points: Number(f.strength_points) || 0,
      show_on_public: f.show_on_public,
      category_id: f.category_id || null,
      is_active: f.is_active,
    };
    startTransition(async () => {
      const res = await save(input);
      if (res.ok) { toast.success(res.message ?? "Saved."); onSaved(); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {dialog.mode === "edit" ? "Edit field" : "New field"}
            {isCore ? <Lock className="h-4 w-4 text-faint" /> : null}
          </DialogTitle>
        </DialogHeader>

        {isCore ? (
          <p className="rounded-lg border border-warm-border bg-warm px-3 py-2 text-xs text-warn-ink">
            This is a core field mapped to a database column. You can relabel it, edit help text, toggle required, and reorder — but its type cannot change and it cannot be deleted.
          </p>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={f.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                value={f.field_type}
                disabled={isCore}
                onChange={(e) => set("field_type", e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Category scope</Label>
              <select
                value={f.category_id}
                onChange={(e) => set("category_id", e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Help text (optional)</Label>
            <Input value={f.help_text} onChange={(e) => set("help_text", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Placeholder (optional)</Label>
            <Input value={f.placeholder} onChange={(e) => set("placeholder", e.target.value)} />
          </div>

          {CHOICE.has(f.field_type) ? (
            <div className="space-y-2">
              <Label>Options</Label>
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={o.label}
                    placeholder="Label"
                    onChange={(e) => setOpts((prev) => prev.map((x, j) => (j === i ? { label: e.target.value, value: x.value || e.target.value } : x)))}
                  />
                  <Button variant="ghost" size="icon" aria-label="Remove option" onClick={() => setOpts((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setOpts((prev) => [...prev, { label: "", value: "" }])}>
                <Plus className="h-4 w-4" /> Add option
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Max length</Label>
              <Input type="number" value={f.max_length} onChange={(e) => set("max_length", e.target.value)} placeholder="none" />
            </div>
            <div className="space-y-1.5">
              <Label>Strength points</Label>
              <Input type="number" value={f.strength_points} onChange={(e) => set("strength_points", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Toggle label="Required" checked={f.is_required} onChange={(v) => set("is_required", v)} />
            <Toggle label="Show on public listing page" checked={f.show_on_public} onChange={(v) => set("show_on_public", v)} />
            <Toggle label="Active" checked={f.is_active} onChange={(v) => set("is_active", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !f.label.trim()}>Save field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
