"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, MoreHorizontal, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTagAction,
  bulkCreateTagsAction,
  renameTagAction,
  toggleTagActiveAction,
  reorderTagsAction,
  deleteTagAction,
  mergeTagsAction,
} from "@/lib/admin/taxonomy-actions";
import type { TagGroupWithMeta, TagWithCount } from "@/lib/admin/taxonomy-queries";

export function TagsTab({
  groups,
  tagsByGroup,
}: {
  groups: TagGroupWithMeta[];
  tagsByGroup: Record<string, TagWithCount[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [tags, setTags] = useState<TagWithCount[]>(tagsByGroup[groupId] ?? []);
  const [newName, setNewName] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [merging, setMerging] = useState<TagWithCount | null>(null);
  const [deleting, setDeleting] = useState<TagWithCount | null>(null);

  useEffect(() => {
    setTags(tagsByGroup[groupId] ?? []);
  }, [groupId, tagsByGroup]);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, msg?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) { if (msg || res.message) toast.success(res.message ?? msg!); router.refresh(); }
      else toast.error(res.error ?? "Something went wrong.");
    });
  }

  function persistOrder(next: TagWithCount[]) {
    setTags(next);
    startTransition(async () => {
      const res = await reorderTagsAction(next.map((t) => t.id));
      if (!res.ok) { toast.error(res.error); router.refresh(); }
    });
  }
  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= tags.length) return;
    const next = [...tags];
    [next[i], next[t]] = [next[t], next[i]];
    persistOrder(next);
  }

  if (!groups.length) {
    return <p className="text-sm text-muted-foreground">Create a tag group first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tag-group">Group</Label>
          <select
            id="tag-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" onClick={() => setShowBulk((s) => !s)}>
          Bulk paste
        </Button>
      </div>

      {showBulk ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <Label htmlFor="bulk">One value per line</Label>
          <Textarea id="bulk" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"1\n2\n3\n4"} />
          <div className="flex gap-2">
            <Button
              disabled={pending || !bulk.trim()}
              onClick={() =>
                run(async () => {
                  const res = await bulkCreateTagsAction(groupId, bulk);
                  if (res.ok) { setBulk(""); setShowBulk(false); }
                  return res;
                })
              }
            >
              Add all
            </Button>
            <Button variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {/* Add one */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a tag…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              run(async () => {
                const res = await createTagAction(groupId, newName);
                if (res.ok) setNewName("");
                return res;
              });
            }
          }}
        />
        <Button
          disabled={pending || !newName.trim()}
          onClick={() =>
            run(async () => {
              const res = await createTagAction(groupId, newName);
              if (res.ok) setNewName("");
              return res;
            })
          }
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="w-16 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Tag</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Listings</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Active</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {tags.map((t, i) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-2 py-2.5">
                  <div className="flex justify-center gap-1">
                    <button type="button" aria-label="Move up" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === tags.length - 1 || pending} onClick={() => move(i, 1)} className="text-faint hover:text-ink disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {renaming?.id === t.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={renaming.value}
                        onChange={(e) => setRenaming({ id: t.id, value: e.target.value })}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            run(async () => renameTagAction(t.id, renaming.value));
                            setRenaming(null);
                          } else if (e.key === "Escape") setRenaming(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { run(async () => renameTagAction(t.id, renaming.value)); setRenaming(null); }}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenaming(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button className="font-semibold text-ink hover:text-indigo" onClick={() => setRenaming({ id: t.id, value: t.name })}>
                      {t.name}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-ink">{t.listing_count}</td>
                <td className="px-3 py-2.5">
                  <Switch checked={t.is_active} onCheckedChange={(v) => run(async () => toggleTagActiveAction(t.id, v))} aria-label="Active" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Tag actions"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setRenaming({ id: t.id, value: t.name })}>Rename</DropdownMenuItem>
                      {tags.length > 1 ? (
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMerging(t); }}>Merge into…</DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem className="text-danger" onSelect={(e) => { e.preventDefault(); setDeleting(t); }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {tags.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">No tags yet — add one above.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Merge dialog */}
      {merging ? (
        <MergeDialog
          source={merging}
          candidates={tags.filter((t) => t.id !== merging.id)}
          onClose={() => setMerging(null)}
          onDone={() => { setMerging(null); router.refresh(); }}
        />
      ) : null}

      {/* Delete dialog */}
      {deleting ? (
        <Dialog open onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Delete “{deleting.name}”?</DialogTitle>
              <DialogDescription>
                {deleting.listing_count > 0
                  ? `${deleting.listing_count} listing${deleting.listing_count === 1 ? "" : "s"} use this tag. Deleting removes it from them.`
                  : "This tag isn't used by any listing."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="destructive" disabled={pending} onClick={() => { run(async () => deleteTagAction(deleting.id)); setDeleting(null); }}>
                Delete tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function MergeDialog({
  source,
  candidates,
  onClose,
  onDone,
}: {
  source: TagWithCount;
  candidates: TagWithCount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Merge “{source.name}”</DialogTitle>
          <DialogDescription>
            Move its {source.listing_count} listing{source.listing_count === 1 ? "" : "s"} onto another tag, then remove “{source.name}”.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Merge into</Label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <option value="">Choose a tag…</option>
            {candidates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !target}
            onClick={() =>
              startTransition(async () => {
                const res = await mergeTagsAction(source.id, target);
                if (res.ok) { toast.success(res.message ?? "Merged."); onDone(); }
                else toast.error(res.error);
              })
            }
          >
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
