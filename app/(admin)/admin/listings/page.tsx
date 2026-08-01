import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, LayoutList, Search } from "lucide-react";
import {
  getAdminListingsPage,
  getListingLookups,
  type ListingsQuery,
} from "@/lib/admin/listing-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListingsTable } from "@/components/admin/listings-table";

export const metadata: Metadata = { title: "Listings" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "pending_review", label: "Pending review" },
  { value: "published", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
  { value: "unpublished", label: "Unpublished" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Deleted" },
];

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const status = one(sp.status) || undefined;
  const categoryId = one(sp.category) || undefined;
  const packageId = one(sp.package) || undefined;
  const esa = one(sp.esa) || undefined;
  const featured = one(sp.featured);
  const city = one(sp.city)?.trim() || undefined;
  const from = one(sp.from) || undefined;
  const to = one(sp.to) || undefined;
  const sort = one(sp.sort) ?? "submitted";
  const dir = (one(sp.dir) as "asc" | "desc") ?? "desc";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const query: ListingsQuery = {
    q,
    status,
    categoryId,
    packageId,
    esa,
    featured: featured === "yes" ? true : featured === "no" ? false : undefined,
    city,
    from,
    to,
    sort,
    dir,
    page,
    pageSize: 25,
  };

  const [result, lookups] = await Promise.all([
    getAdminListingsPage(query),
    getListingLookups(),
  ]);

  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries({
    q,
    status,
    category: categoryId,
    package: packageId,
    esa,
    featured,
    city,
    from,
    to,
  })) {
    if (v) params[k] = v;
  }
  params.sort = sort;
  params.dir = dir;

  const pageHref = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/admin/listings?${next.toString()}`;
  };
  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Listings"
        lede={`${result.total} ${result.total === 1 ? "listing" : "listings"}.`}
        actions={
          <Button asChild>
            <Link href="/admin/listings/review">
              <ClipboardCheck className="h-4 w-4" /> Review queue
            </Link>
          </Button>
        }
      />

      <form
        method="get"
        className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, owner email, or city"
            className="pl-9"
            aria-label="Search listings"
          />
        </div>
        <Sel name="status" label="Status" value={status ?? ""} options={STATUS_OPTIONS} />
        <Sel
          name="category"
          label="Category"
          value={categoryId ?? ""}
          options={[
            { value: "", label: "Any category" },
            ...lookups.categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Sel
          name="package"
          label="Package"
          value={packageId ?? ""}
          options={[
            { value: "", label: "Any package" },
            ...lookups.packages.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <Sel
          name="esa"
          label="ESA"
          value={esa ?? ""}
          options={[
            { value: "", label: "ESA: any" },
            { value: "yes", label: "Accepts ESA" },
            { value: "no", label: "No ESA" },
            { value: "unsure", label: "ESA: unsure" },
          ]}
        />
        <Sel
          name="featured"
          label="Featured"
          value={featured ?? ""}
          options={[
            { value: "", label: "Featured: any" },
            { value: "yes", label: "Featured" },
            { value: "no", label: "Not featured" },
          ]}
        />
        <Input name="city" defaultValue={city ?? ""} placeholder="City" aria-label="City" />
        <div className="flex items-center gap-2">
          <Input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            aria-label="Submitted from"
            className="min-w-0"
          />
          <span className="text-faint">–</span>
          <Input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            aria-label="Submitted to"
            className="min-w-0"
          />
        </div>

        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />

        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="ghost">
            <Link href="/admin/listings">Reset</Link>
          </Button>
        </div>
      </form>

      {result.rows.length ? (
        <>
          <ListingsTable rows={result.rows} params={params} />
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
          icon={LayoutList}
          title="No listings match"
          description="Try clearing a filter or searching a different term."
        />
      )}
    </div>
  );
}

function Sel({
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
