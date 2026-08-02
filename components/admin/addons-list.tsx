"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/format";
import { effectLabel } from "@/lib/addons/effects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  reorderAddonsAction,
  archiveAddonAction,
  deleteAddonAction,
} from "@/lib/admin/addons-actions";
import type { AddonWithSales } from "@/lib/admin/addons-queries";

const SUFFIX: Record<string, string> = { one_time: " once", month: "/mo", year: "/yr" };

export function AddonsList({ addons }: { addons: AddonWithSales[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(addons);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(next: AddonWithSales[]) {
    setRows(next);
    startTransition(async () => {
      const res = await reorderAddonsAction(next.map((a) => a.id));
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
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
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
      } else toast.error(res.error ?? `Couldn't ${label.toLowerCase()}.`);
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left">
            <th className="w-8 px-2 py-2.5" />
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Add-on</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Price</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Effect</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Sold</th>
            <th className="px-3 py-2.5 font-semibold text-muted-foreground">Active</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr
              key={a.id}
              draggable
              onDragStart={() => setDragId(a.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(a.id)}
              className={`border-b border-border last:border-0 hover:bg-secondary/30 ${
                dragId === a.id ? "opacity-50" : ""
              }`}
            >
              <td className="px-2 py-2.5">
                <div className="flex flex-col items-center">
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
                  href={`/admin/addons/${a.id}`}
                  className="font-semibold text-ink no-underline hover:text-indigo"
                >
                  {a.name}
                </Link>
                {a.short_description ? (
                  <div className="text-xs text-faint">{a.short_description}</div>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-ink">
                {a.price_cents > 0
                  ? `${formatCurrency(a.price_cents, { fromCents: true })}${SUFFIX[a.interval] ?? ""}`
                  : "Free"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {effectLabel(a.effect)}
                {a.effect_value ? ` (${a.effect_value})` : ""}
              </td>
              <td className="px-3 py-2.5 text-ink">{a.times_sold}</td>
              <td className="px-3 py-2.5">
                {a.is_active ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="outline">Archived</Badge>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Add-on actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/addons/${a.id}`}>Edit</Link>
                    </DropdownMenuItem>
                    {a.is_active ? (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          runAction("Archive", () => archiveAddonAction(a.id));
                        }}
                      >
                        Archive
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-danger"
                      onSelect={(e) => {
                        e.preventDefault();
                        runAction("Delete", () => deleteAddonAction(a.id));
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
