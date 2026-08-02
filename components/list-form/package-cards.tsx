"use client";

import { Check, Star } from "lucide-react";
import type { FormPackage } from "@/lib/list-form/types";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function PackageCards({
  packages,
  selectedSlug,
  onSelect,
}: {
  packages: FormPackage[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {packages.map((pkg) => {
        const active = pkg.slug === selectedSlug;
        const isPaid = pkg.priceCents > 0;
        return (
          <button
            key={pkg.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(pkg.slug)}
            className={cn(
              "relative flex flex-col rounded-xl border-[1.5px] p-5 text-left transition-colors",
              active
                ? "border-violet ring-[3px] ring-violet-soft"
                : "border-border-strong hover:border-violet/60",
            )}
          >
            {pkg.badgeLabel || pkg.allowsFeatured ? (
              <span className="absolute -top-2.5 right-3.5 inline-flex items-center gap-1 rounded-full bg-violet px-2.5 py-1 text-[11px] font-bold text-white">
                <Star className="h-3 w-3 fill-white" />
                {pkg.badgeLabel ?? "Recommended"}
              </span>
            ) : null}

            <h3 className="font-display text-[17px] font-extrabold text-ink">
              {pkg.name}
            </h3>
            {pkg.tagline ? (
              <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                {pkg.tagline}
              </p>
            ) : null}

            {pkg.features.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {pkg.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[13.5px] text-muted-foreground"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        isPaid ? "text-violet" : "text-good",
                      )}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-auto pt-4 font-display text-[22px] font-extrabold text-ink">
              {isPaid ? formatCurrency(pkg.priceCents, { fromCents: true }) : "$0"}
              {isPaid ? (
                <span className="block font-body text-[12.5px] font-medium text-muted-foreground">
                  / {pkg.interval === "year" ? "year" : pkg.interval} · cancel
                  anytime
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
