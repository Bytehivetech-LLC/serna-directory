"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  MoreHorizontal,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  reorderPackagesAction,
  archivePackageAction,
  deletePackageAction,
} from "@/lib/admin/packages-actions";
import type { PackageWithCount } from "@/lib/admin/packages-queries";

const INTERVAL_SUFFIX: Record<string, string> = {
  one_time: " once",
  month: "/mo",
  year: "/yr",
};

export function PackagesList({ packages }: { packages: PackageWithCount[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(packages);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(next: PackageWithCount[]) {
    setRows(next);
    startTransition(async () => {
      const res = await reorderPackagesAction(next.map((p) => p.id));
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
      }
    });
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }

  function onDrop(overId: string) {
    if (!dragId || dragId === overId) return;
    const from = rows.findIndex((r) => r.id === dragId);
    const to = rows.findIndex((r) => r.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persist(next);
  }

  function runAction(
    label: string,
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? `${label} done.`);
        router.refresh();
      } else {
        toast.error(res.error ?? `Couldn't ${label.toLowerCase()}.`);
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left">
            <th className="w-8 px-2 py-2.5" />
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Package</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Price</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Listings</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Approval</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Subs</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Active</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(p.id)}
              className={`border-b border-border last:border-0 hover:bg-secondary/30 ${
                dragId === p.id ? "opacity-50" : ""
              }`}
            >
              <td className="px-2 py-2.5">
                <div className="flex flex-col items-center gap-0.5">
                  <GripVertical className="h-4 w-4 cursor-grab text-faint" aria-hidden />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0 || pending}
                      onClick={() => move(i, -1)}
                      className="text-faint hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === rows.length - 1 || pending}
                      onClick={() => move(i, 1)}
                      className="text-faint hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <Link
                  href={`/admin/packages/${p.id}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-ink no-underline hover:text-indigo"
                >
                  {p.is_default ? (
                    <Star className="h-3.5 w-3.5 fill-violet text-violet" aria-label="Default" />
                  ) : null}
                  {p.name}
                </Link>
                {p.badge_label ? (
                  <span
                    className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: p.badge_color ?? "#6c4ce8" }}
                  >
                    {p.badge_label}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-ink">
                {p.price_cents > 0
                  ? `${formatCurrency(p.price_cents, { fromCents: true })}${INTERVAL_SUFFIX[p.interval] ?? ""}`
                  : "Free"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {p.min_listings}–{p.max_listings ?? "∞"}
              </td>
              <td className="px-3 py-2.5">
                {p.requires_approval ? (
                  <Check className="h-4 w-4 text-good" />
                ) : (
                  <X className="h-4 w-4 text-faint" />
                )}
              </td>
              <td className="px-3 py-2.5 text-ink">{p.subscriber_count}</td>
              <td className="px-3 py-2.5">
                {p.is_active ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="outline">Archived</Badge>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Package actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/packages/${p.id}`}>Edit</Link>
                    </DropdownMenuItem>
                    {p.is_active ? (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          runAction("Archive", () => archivePackageAction(p.id));
                        }}
                      >
                        Archive
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-danger"
                      onSelect={(e) => {
                        e.preventDefault();
                        runAction("Delete", () => deletePackageAction(p.id));
                      }}
                    >
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
  );
}
