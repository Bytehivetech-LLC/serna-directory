"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  EyeOff,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  approveListingAction,
  bulkApproveListingsAction,
  bulkDeleteListingsAction,
  bulkUnpublishListingsAction,
  permanentDeleteListingAction,
  restoreListingAction,
  softDeleteListingAction,
  unpublishListingAction,
} from "@/lib/admin/listing-actions";
import type { AdminListingRow } from "@/lib/admin/listing-queries";

type SortCol = "name" | "status" | "completeness" | "submitted";

const WEB = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending",
  published: "Live",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
  deleted: "Deleted",
};

/** A distinct colour per status so "why isn't this live" is answerable at a glance. */
function statusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-good-soft text-good";
    case "pending_review":
      return "bg-violet-soft text-violet";
    case "rejected":
      return "bg-danger-soft text-danger";
    case "draft":
      return "bg-secondary text-muted-foreground";
    case "unpublished":
      return "bg-secondary text-ink";
    case "archived":
    case "deleted":
      return "border border-border-strong bg-card text-faint";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

export function ListingsTable({
  rows,
  params,
  status,
}: {
  rows: AdminListingRow[];
  params: Record<string, string>;
  /** The current status filter (the view). "deleted" swaps in Restore. */
  status?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [permRow, setPermRow] = useState<AdminListingRow | null>(null);
  const [permConfirm, setPermConfirm] = useState("");

  const isDeletedView = status === "deleted";
  const curSort = params.sort ?? "submitted";
  const curDir = params.dir ?? "desc";
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function sortHref(col: SortCol): string {
    const next = new URLSearchParams(params);
    const dir = curSort === col && curDir === "asc" ? "desc" : "asc";
    next.set("sort", col);
    next.set("dir", dir);
    next.set("page", "1");
    return `/admin/listings?${next.toString()}`;
  }

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
    after?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? `${label} done.`);
        setSelected(new Set());
        after?.();
        router.refresh();
      } else {
        toast.error(res.error ?? `Couldn't ${label.toLowerCase()}.`);
      }
    });
  }

  const ids = () => [...selected];

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet/30 bg-violet-soft px-4 py-2.5">
          <span className="text-sm font-semibold text-indigo-deep">
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {!isDeletedView ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run("Approve", () => bulkApproveListingsAction(ids()))}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run("Unpublish", () => bulkUnpublishListingsAction(ids()))}
                >
                  <EyeOff className="h-4 w-4" /> Unpublish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  className="border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
                  onClick={() => {
                    setConfirm("");
                    setBulkDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run("Restore", async () => {
                    const results = await Promise.all(ids().map((id) => restoreListingAction(id)));
                    const failed = results.find((r) => !r.ok);
                    return failed ?? { ok: true, message: `${results.length} restored.` };
                  })
                }
              >
                <RotateCcw className="h-4 w-4" /> Restore
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2.5" />
              <SortHead label="Listing" col="name" curSort={curSort} curDir={curDir} href={sortHref} />
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Owner</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Category</th>
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Package</th>
              <SortHead label="Status" col="status" curSort={curSort} curDir={curDir} href={sortHref} />
              <SortHead label="Submitted" col="submitted" curSort={curSort} curDir={curDir} href={sortHref} />
              <SortHead label="%" col="completeness" curSort={curSort} curDir={curDir} href={sortHref} />
              <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr
                key={l.id}
                className="border-b border-border last:border-0 hover:bg-secondary/30"
              >
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={selected.has(l.id)}
                    onCheckedChange={() => toggle(l.id)}
                    aria-label={`Select ${l.business_name}`}
                  />
                </td>
                <td className="py-2 pl-3">
                  {l.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.cover_url}
                      alt=""
                      className="h-9 w-9 rounded-md object-cover"
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-faint">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/listings/${l.id}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-ink no-underline hover:text-indigo"
                  >
                    {l.is_featured ? (
                      <Star className="h-3.5 w-3.5 fill-violet text-violet" />
                    ) : null}
                    {l.business_name}
                  </Link>
                  {l.city ? <div className="text-xs text-faint">{l.city}</div> : null}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{l.owner_email ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{l.category_name ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{l.package_name ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      statusBadgeClass(isDeletedView ? "deleted" : l.status),
                    )}
                  >
                    {isDeletedView ? "Deleted" : STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {l.submitted_at ? formatDate(l.submitted_at) : "—"}
                </td>
                <td className="px-3 py-2.5 text-ink">{l.completeness}%</td>
                <td className="px-3 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${l.business_name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/listings/${l.id}`}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      {l.slug ? (
                        <DropdownMenuItem asChild>
                          <a href={`${WEB}/listing/${l.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" /> View public
                          </a>
                        </DropdownMenuItem>
                      ) : null}

                      {isDeletedView ? (
                        <DropdownMenuItem
                          disabled={pending}
                          onClick={() => run("Restore", () => restoreListingAction(l.id))}
                        >
                          <RotateCcw className="h-4 w-4" /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <>
                          {l.status === "pending_review" ? (
                            <DropdownMenuItem
                              disabled={pending}
                              onClick={() => run("Approve", () => approveListingAction(l.id))}
                            >
                              <Check className="h-4 w-4" /> Approve
                            </DropdownMenuItem>
                          ) : null}
                          {l.status === "published" ? (
                            <DropdownMenuItem
                              disabled={pending}
                              onClick={() => run("Unpublish", () => unpublishListingAction(l.id))}
                            >
                              <EyeOff className="h-4 w-4" /> Unpublish
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => run("Delete", () => softDeleteListingAction(l.id))}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onClick={() => {
                          setPermConfirm("");
                          setPermRow(l);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk soft-delete */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Delete {selected.size} {selected.size === 1 ? "listing" : "listings"}?
            </DialogTitle>
            <DialogDescription>
              This soft-deletes and archives the selected listings — they can be
              restored from the Deleted filter. Type <b className="text-ink">DELETE</b> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-delete-confirm">Confirmation</Label>
            <Input
              id="bulk-delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "DELETE" || pending}
              onClick={() =>
                run("Delete", () => bulkDeleteListingsAction(ids()), () => setBulkDeleteOpen(false))
              }
            >
              Delete listings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-row permanent delete */}
      <Dialog open={permRow !== null} onOpenChange={(o) => !o && setPermRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Permanently delete this listing?</DialogTitle>
            <DialogDescription>
              This removes <b className="text-ink">{permRow?.business_name}</b> for good and queues
              its photos for deletion. This cannot be undone. Type{" "}
              <b className="text-ink">DELETE PERMANENTLY</b> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="perm-delete-confirm">Confirmation</Label>
            <Input
              id="perm-delete-confirm"
              value={permConfirm}
              onChange={(e) => setPermConfirm(e.target.value)}
              placeholder="DELETE PERMANENTLY"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={permConfirm !== "DELETE PERMANENTLY" || pending}
              onClick={() => {
                const row = permRow;
                if (!row) return;
                run(
                  "Delete permanently",
                  () => permanentDeleteListingAction(row.id, permConfirm),
                  () => setPermRow(null),
                );
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortHead({
  label,
  col,
  curSort,
  curDir,
  href,
}: {
  label: string;
  col: SortCol;
  curSort: string;
  curDir: string;
  href: (col: SortCol) => string;
}) {
  const active = curSort === col;
  return (
    <th className="px-3 py-2.5 font-semibold text-muted-foreground">
      <Link
        href={href(col)}
        className={cn(
          "inline-flex items-center gap-1 no-underline hover:text-ink",
          active && "text-ink",
        )}
      >
        {label}
        {active ? (
          curDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : null}
      </Link>
    </th>
  );
}
