"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  createCategoryAction,
  updateCategoryAction,
  reorderCategoriesAction,
  deleteCategoryAction,
  moveCategoryListingsAction,
  type CategoryInput,
} from "@/lib/admin/taxonomy-actions";
import type { CategoryWithCount } from "@/lib/admin/taxonomy-queries";

type Editing = { id: string | null; data: CategoryWithCount | null };

export function CategoriesTab({
  categories,
  categoryLookups,
}: {
  categories: CategoryWithCount[];
  categoryLookups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(categories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);

  function persist(next: CategoryWithCount[]) {
    setRows(next);
    startTransition(async () => {
      const res = await reorderCategoriesAction(next.map((c) => c.id));
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
      }
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ id: null, data: null })}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Name</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Slug</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Listings</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Active</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr
                key={c.id}
                draggable
                onDragStart={() => setDragId(c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(c.id)}
                className={`border-b border-border last:border-0 hover:bg-secondary/30 ${dragId === c.id ? "opacity-50" : ""}`}
              >
                <td className="px-2 py-2.5">
                  <div className="flex flex-col items-center">
                    <GripVertical className="h-4 w-4 cursor-grab text-faint" aria-hidden />
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move up" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-faint hover:text-ink disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" aria-label="Move down" disabled={i === rows.length - 1 || pending} onClick={() => move(i, 1)} className="text-faint hover:text-ink disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <button className="font-semibold text-ink hover:text-indigo" onClick={() => setEditing({ id: c.id, data: c })}>
                    {c.name}
                  </button>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.slug}</td>
                <td className="px-3 py-2.5 text-ink">{c.listing_count_live}</td>
                <td className="px-3 py-2.5">
                  {c.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Off</Badge>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Category actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing({ id: c.id, data: c })}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-danger" onSelect={(e) => { e.preventDefault(); setDeleting(c); }}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <CategoryDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteCategoryDialog
          category={deleting}
          destinations={categoryLookups.filter((c) => c.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = editing.data;
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    icon: c?.icon ?? "",
    description: c?.description ?? "",
    ages_label: c?.ages_label ?? "Ages / grades",
    rate_label: c?.rate_label ?? "Rate",
    is_active: c?.is_active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const slugChanged = Boolean(c) && f.slug.trim() !== c!.slug;
  const inUse = (c?.listing_count_live ?? 0) > 0;

  function save() {
    const input: CategoryInput = {
      name: f.name.trim(),
      slug: f.slug.trim() || undefined,
      icon: f.icon.trim() || null,
      description: f.description.trim() || null,
      ages_label: f.ages_label.trim() || "Ages / grades",
      rate_label: f.rate_label.trim() || "Rate",
      is_active: f.is_active,
    };
    startTransition(async () => {
      const res = editing.id ? await updateCategoryAction(editing.id, input) : await createCategoryAction(input);
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        onSaved();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{editing.id ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Slug">
              <Input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto from name" />
            </Field>
          </div>
          {slugChanged && inUse ? (
            <p className="rounded-lg border border-warm-border bg-warm px-3 py-2 text-xs text-[#7a5a1e]">
              This category is used by {c!.listing_count_live} listing
              {c!.listing_count_live === 1 ? "" : "s"}. Changing its slug will change their URLs and any shared filter links.
            </p>
          ) : null}
          <Field label="Icon (optional)">
            <Input value={f.icon} onChange={(e) => set("icon", e.target.value)} placeholder="e.g. graduation-cap" />
          </Field>
          <Field label="Description (optional)">
            <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ages label (form)">
              <Input value={f.ages_label} onChange={(e) => set("ages_label", e.target.value)} />
            </Field>
            <Field label="Rate label (form)">
              <Input value={f.rate_label} onChange={(e) => set("rate_label", e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Active</span>
            <Switch checked={f.is_active} onCheckedChange={(v) => set("is_active", v)} aria-label="Active" />
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

function DeleteCategoryDialog({
  category,
  destinations,
  onClose,
  onDone,
}: {
  category: CategoryWithCount;
  destinations: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dest, setDest] = useState("");
  const hasListings = category.listing_count_live > 0;

  function moveThenRefresh() {
    if (!dest) return;
    startTransition(async () => {
      const res = await moveCategoryListingsAction(category.id, dest);
      if (res.ok) {
        toast.success(res.message ?? "Moved.");
        onDone();
      } else toast.error(res.error);
    });
  }
  function del() {
    startTransition(async () => {
      const res = await deleteCategoryAction(category.id);
      if (res.ok) {
        toast.success(res.message ?? "Deleted.");
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Delete {category.name}?</DialogTitle>
        </DialogHeader>
        {hasListings ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {category.listing_count_live} listing{category.listing_count_live === 1 ? "" : "s"} use this category. Move them somewhere else first, then delete.
            </p>
            <Field label="Move listings to">
              <select
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <option value="">Choose a category…</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This category has no listings and can be deleted.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {hasListings ? (
            <Button onClick={moveThenRefresh} disabled={pending || !dest}>Move listings</Button>
          ) : (
            <Button variant="destructive" onClick={del} disabled={pending}>Delete category</Button>
          )}
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
