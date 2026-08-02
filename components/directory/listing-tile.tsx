"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import type { DirectoryListing } from "@/lib/directory/types";
import { cn } from "@/lib/utils/cn";

export function ListingTile({
  listing,
  active,
  onHover,
}: {
  listing: DirectoryListing;
  active?: boolean;
  onHover?: (id: string | null) => void;
}) {
  return (
    <Link
      href={`/listing/${listing.slug}`}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "group block overflow-hidden rounded-xl border bg-card no-underline shadow-card transition-colors",
        active ? "border-violet ring-2 ring-violet/30" : "border-border hover:border-violet",
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-violet-soft to-secondary">
        {listing.coverUrl ? (
          <Image
            src={listing.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-3xl font-extrabold text-violet/40">
              {(listing.businessName[0] ?? "S").toUpperCase()}
            </span>
          </div>
        )}

        {listing.isFeatured ? (
          <span className="absolute left-0 top-3 inline-flex items-center gap-1 rounded-r-full bg-violet py-1 pl-3 pr-3.5 text-xs font-bold text-white shadow">
            <Star className="h-3 w-3 fill-white" aria-hidden />
            Featured
          </span>
        ) : null}
      </div>

      <div className="p-4">
        <h3 className="font-display text-base font-semibold leading-snug text-ink">
          {listing.businessName}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {listing.categoryName ? (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {listing.categoryName}
            </span>
          ) : null}
          {listing.city ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {listing.city}
            </span>
          ) : null}
          {listing.acceptsEsa === "yes" ? (
            <span className="rounded-full bg-good-soft px-2.5 py-0.5 text-xs font-bold text-good">
              ESA
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
