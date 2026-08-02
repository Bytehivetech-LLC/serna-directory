"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTagGroupAction,
  updateTagGroupAction,
  reorderTagGroupsAction,
  toggleGroupFlagAction,
  deleteTagGroupAction,
  type TagGroupInput,
} from "@/lib/admin/taxonomy-actions";
import type { TagGroupWithMeta } from "@/lib/admin/taxonomy-queries";

type Editing = { id: string | null; data: TagGroupWithMeta | null };
type Flag = "show_in_form" | "show_in_filter" | "show_on_listing";

export function TagGroupsTab({
  groups,
  categoryLookups,
}: {
  groups: TagGroupWithMeta[];
  categoryLookups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(groups);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Editing | null>(null);

  function persist(next: TagGroupWithMeta[]) {
    setRows(next);
    startTransition(async () => {
      const res = await reorderTagGroupsAction(next.map((g) => g.id));
      if (!res.ok) { toast.error(res.error); router.refresh(); }
    });
  }
  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= rows.length) return;
    const next = [...rows];
    [next[i], next[t]] = [next[t], next[i]];
    persist(next);
  }
  function onDrop(overId: string) {
    if (!dragId || dragId === overId) return;
    const from = rows.findIndex((r) => r.id === dragId);
    const to = rows.findIndex((r) => r.id === overId);
    const next = [...rows];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setDragId(null);
    persist(next);
  }
  function toggleFlag(g: TagGroupWithMeta, flag: Flag, value: boolean) {
    setRows((prev) => prev.map((r) => (r.id === g.id ? { ...r, [flag]: value } : r)));
    startTransition(async () => {
      const res = await toggleGroupFlagAction(g.id, flag, value);
      if (!res.ok) { toast.error(res.error); router.refresh(); }
    });
  }
  function del(g: TagGroupWithMeta) {
    startTransition(async () => {
      const res = await deleteTagGroupAction(g.id);
      if (res.ok) { toast.success(res.message ?? "Deleted."); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ id: null, data: null })}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Group</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Scope</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Select</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Form</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Filters</th>
              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Listing</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <tr
                key={g.id}
                draggable
                onDragStart={() => setDragId(g.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(g.id)}
                className={`border-b border-border last:border-0 hover:bg-secondary/30 ${dragId === g.id ? "opacity-50" : ""}`}
              >
                <td className="px-2 py-2.5">
                  <div className="flex flex-col items-center">
                    <GripVertical className="h-4 w-4 cursor-grab text-faint" aria-hidden />
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move up" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                      <button type="button" aria-label="Move down" disabled={i === rows.length - 1 || pending} onClick={() => move(i, 1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <button className="font-semibold text-ink hover:text-indigo" onClick={() => setEditing({ id: g.id, data: g })}>
                    {g.name}
                  </button>
                  <div className="text-xs text-faint">{g.tag_count} tags</div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{g.category_name ?? "All categories"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{g.selection_type === "single" ? "Single" : "Multi"}</td>
                <td className="px-3 py-2.5 text-center">
                  <Switch checked={g.show_in_form} onCheckedChange={(v) => toggleFlag(g, "show_in_form", v)} aria-label="Show in form" />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Switch checked={g.show_in_filter} onCheckedChange={(v) => toggleFlag(g, "show_in_filter", v)} aria-label="Show in filters" />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Switch checked={g.show_on_listing} onCheckedChange={(v) => toggleFlag(g, "show_on_listing", v)} aria-label="Show on listing" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Group actions"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing({ id: g.id, data: g })}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-danger" onSelect={(e) => { e.preventDefault(); del(g); }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <GroupDialog editing={editing} categoryLookups={categoryLookups} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
      ) : null}
    </div>
  );
}

function GroupDialog({
  editing,
  categoryLookups,
  onClose,
  onSaved,
}: {
  editing: Editing;
  categoryLookups: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const g = editing.data;
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    name: g?.name ?? "",
    slug: g?.slug ?? "",
    description: g?.description ?? "",
    category_id: g?.category_id ?? "",
    selection_type: g?.selection_type ?? "multi",
    show_in_form: g?.show_in_form ?? true,
    show_in_filter: g?.show_in_filter ?? true,
    show_on_listing: g?.show_on_listing ?? true,
    sort_mode: g?.sort_mode ?? "alphabetical",
    is_active: g?.is_active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    const input: TagGroupInput = {
      name: f.name.trim(),
      slug: f.slug.trim() || undefined,
      description: f.description.trim() || null,
      category_id: f.category_id || null,
      selection_type: f.selection_type as "single" | "multi",
      show_in_form: f.show_in_form,
      show_in_filter: f.show_in_filter,
      show_on_listing: f.show_on_listing,
      sort_mode: f.sort_mode as "alphabetical" | "manual",
      is_active: f.is_active,
    };
    startTransition(async () => {
      const res = editing.id ? await updateTagGroupAction(editing.id, input) : await createTagGroupAction(input);
      if (res.ok) { toast.success(res.message ?? "Saved."); onSaved(); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{editing.id ? "Edit group" : "New tag group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Slug"><Input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" /></Field>
          </div>
          <Field label="Description (optional)">
            <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category scope">
              <select value={f.category_id} onChange={(e) => set("category_id", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                <option value="">All categories</option>
                {categoryLookups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Selection">
              <select value={f.selection_type} onChange={(e) => set("selection_type", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                <option value="multi">Multi-select</option>
                <option value="single">Single-select</option>
              </select>
            </Field>
          </div>
          <Field label="Sort mode">
            <select value={f.sort_mode} onChange={(e) => set("sort_mode", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
              <option value="alphabetical">Alphabetical</option>
              <option value="manual">Manual (drag order)</option>
            </select>
          </Field>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Toggle label="Show in form" checked={f.show_in_form} onChange={(v) => set("show_in_form", v)} />
            <Toggle label="Show in filters" checked={f.show_in_filter} onChange={(v) => set("show_in_filter", v)} />
            <Toggle label="Show on listing page" checked={f.show_on_listing} onChange={(v) => set("show_on_listing", v)} />
            <Toggle label="Active" checked={f.is_active} onChange={(v) => set("is_active", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={pending || !f.name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
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
