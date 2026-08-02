"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, EyeOff, ImageIcon, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkApproveListingsAction,
  bulkUnpublishListingsAction,
  bulkDeleteListingsAction,
} from "@/lib/admin/listing-actions";
import type { AdminListingRow } from "@/lib/admin/listing-queries";

type SortCol = "name" | "status" | "completeness" | "submitted";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending",
  published: "Live",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "published") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export function ListingsTable({
  rows,
  params,
}: {
  rows: AdminListingRow[];
  params: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

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

  function runBulk(
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
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runBulk("Approve", () => bulkApproveListingsAction(ids()))}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                runBulk("Unpublish", () => bulkUnpublishListingsAction(ids()))
              }
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
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[860px] border-collapse text-sm">
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
                  {l.city ? (
                    <div className="text-xs text-faint">{l.city}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {l.owner_email ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {l.category_name ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {l.package_name ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusVariant(l.status)}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {l.submitted_at ? formatDate(l.submitted_at) : "—"}
                </td>
                <td className="px-3 py-2.5 text-ink">{l.completeness}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Delete {selected.size} {selected.size === 1 ? "listing" : "listings"}?
            </DialogTitle>
            <DialogDescription>
              This soft-deletes and archives the selected listings. Type{" "}
              <b className="text-ink">DELETE</b> to confirm.
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
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "DELETE" || pending}
              onClick={() =>
                runBulk("Delete", () => bulkDeleteListingsAction(ids()), () =>
                  setDeleteOpen(false),
                )
              }
            >
              Delete listings
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
