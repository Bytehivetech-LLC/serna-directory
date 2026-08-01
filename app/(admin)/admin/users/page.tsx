import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users as UsersIcon } from "lucide-react";
import { getUsersPage, type UsersQuery } from "@/lib/admin/queries";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Users" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function tri(v: string | undefined): boolean | undefined {
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const role = one(sp.role) || undefined;
  const verified = one(sp.verified);
  const suspended = one(sp.suspended);
  const hasListings = one(sp.has_listings);
  const sort = one(sp.sort) ?? "created_at";
  const dir = (one(sp.dir) as "asc" | "desc") ?? "desc";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const query: UsersQuery = {
    q,
    role,
    verified: tri(verified),
    suspended: tri(suspended),
    hasListings: tri(hasListings),
    sort,
    dir,
    page,
    pageSize: 25,
  };
  const result = await getUsersPage(query);

  // Preserve the active query on sort links + pagination.
  const params: Record<string, string> = {};
  if (q) params.q = q;
  if (role) params.role = role;
  if (verified) params.verified = verified;
  if (suspended) params.suspended = suspended;
  if (hasListings) params.has_listings = hasListings;
  params.sort = sort;
  params.dir = dir;

  const pageHref = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/admin/users?${next.toString()}`;
  };

  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Users"
        lede={`${result.total} ${result.total === 1 ? "account" : "accounts"}.`}
      />

      {/* Filters — a plain GET form: search is server-side and shareable. */}
      <form
        method="get"
        className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email"
            className="pl-9"
            aria-label="Search users"
          />
        </div>

        <FilterSelect name="role" label="Role" value={role ?? ""} options={[
          { value: "", label: "Any role" },
          { value: "user", label: "User" },
          { value: "moderator", label: "Moderator" },
          { value: "admin", label: "Admin" },
        ]} />
        <FilterSelect name="verified" label="Verified" value={verified ?? ""} options={[
          { value: "", label: "Verified: any" },
          { value: "yes", label: "Verified" },
          { value: "no", label: "Not verified" },
        ]} />
        <FilterSelect name="suspended" label="Suspended" value={suspended ?? ""} options={[
          { value: "", label: "Suspended: any" },
          { value: "yes", label: "Suspended" },
          { value: "no", label: "Not suspended" },
        ]} />
        <FilterSelect name="has_listings" label="Has listings" value={hasListings ?? ""} options={[
          { value: "", label: "Listings: any" },
          { value: "yes", label: "Has listings" },
          { value: "no", label: "No listings" },
        ]} />

        {/* Keep the current sort when filters change; reset to page 1. */}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />

        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="ghost">
            <Link href="/admin/users">Reset</Link>
          </Button>
        </div>
      </form>

      {result.rows.length ? (
        <>
          <UsersTable rows={result.rows} params={params} />

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">
              Showing {first}–{last} of {result.total}
            </span>
            <div className="flex gap-2">
              {result.page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(result.page - 1)}>Previous</Link>
                </Button>
              )}
              {result.page >= result.pageCount ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(result.page + 1)}>Next</Link>
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={UsersIcon}
          title="No users match"
          description="Try clearing a filter or searching a different name or email."
        />
      )}
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
