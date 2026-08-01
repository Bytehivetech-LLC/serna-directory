"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BadgeCheck, Ban } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  verifyUsersAction,
  suspendUsersAction,
} from "@/lib/admin/users-actions";
import type { UserRow } from "@/lib/admin/queries";

const ROLE_LABEL: Record<string, string> = {
  user: "User",
  moderator: "Moderator",
  admin: "Admin",
};

type SortCol = "name" | "email" | "role" | "listings" | "created_at";

export function UsersTable({
  rows,
  params,
}: {
  rows: UserRow[];
  params: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const curSort = params.sort ?? "created_at";
  const curDir = params.dir ?? "desc";

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0;

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
    return `/admin/users?${next.toString()}`;
  }

  function runBulk(
    label: string,
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? `${label} done.`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error ?? `Couldn't ${label.toLowerCase()}.`);
      }
    });
  }

  const ids = () => [...selected];

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {someSelected ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet/30 bg-violet-soft px-4 py-2.5">
          <span className="text-sm font-semibold text-indigo-deep">
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runBulk("Verify", () => verifyUsersAction(ids(), true))}
            >
              <BadgeCheck className="h-4 w-4" /> Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                runBulk("Unverify", () => verifyUsersAction(ids(), false))
              }
            >
              Unverify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                runBulk("Suspend", () => suspendUsersAction(ids(), true))
              }
            >
              <Ban className="h-4 w-4" /> Suspend
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                runBulk("Unsuspend", () => suspendUsersAction(ids(), false))
              }
            >
              Unsuspend
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <SortHead label="Name" col="name" curSort={curSort} curDir={curDir} href={sortHref} />
              <SortHead label="Email" col="email" curSort={curSort} curDir={curDir} href={sortHref} />
              <SortHead label="Role" col="role" curSort={curSort} curDir={curDir} href={sortHref} />
              <th className="px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
              <SortHead label="Listings" col="listings" curSort={curSort} curDir={curDir} href={sortHref} />
              <SortHead label="Joined" col="created_at" curSort={curSort} curDir={curDir} href={sortHref} />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.id}
                className="border-b border-border last:border-0 hover:bg-secondary/30"
              >
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={selected.has(u.id)}
                    onCheckedChange={() => toggle(u.id)}
                    aria-label={`Select ${u.email}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="font-semibold text-ink no-underline hover:text-indigo"
                  >
                    {u.full_name || "—"}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {u.is_verified ? (
                      <Badge className="bg-good-soft text-good hover:bg-good-soft">
                        Verified
                      </Badge>
                    ) : null}
                    {u.is_suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : null}
                    {!u.is_verified && !u.is_suspended ? (
                      <span className="text-faint">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-ink">{u.listing_count}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {formatDate(u.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
