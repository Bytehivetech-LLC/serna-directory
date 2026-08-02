"use client";

import { Info, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import type { FormAddon } from "@/lib/list-form/types";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SUFFIX: Record<string, string> = { one_time: "", month: "/mo", year: "/yr" };

export type ExtrasSelection = Record<string, number>;

export function addonsForPackage(
  addons: FormAddon[],
  packageId: string | null,
): FormAddon[] {
  return addons.filter(
    (a) => a.packageIds.length === 0 || (packageId != null && a.packageIds.includes(packageId)),
  );
}

export function extrasTotalCents(
  addons: FormAddon[],
  selected: ExtrasSelection,
): number {
  return addons.reduce((sum, a) => sum + (selected[a.id] ?? 0) * a.priceCents, 0);
}

export function ExtrasPicker({
  addons,
  packageId,
  selected,
  onChange,
}: {
  addons: FormAddon[];
  packageId: string | null;
  selected: ExtrasSelection;
  onChange: (addonId: string, quantity: number) => void;
}) {
  const available = addonsForPackage(addons, packageId);
  if (!available.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {available.map((a) => {
        const qty = selected[a.id] ?? 0;
        const active = qty > 0;
        const stepper = a.maxQuantity > 1;
        return (
          <div
            key={a.id}
            className={cn(
              "rounded-xl border-[1.5px] p-4 transition-colors",
              active ? "border-violet bg-violet-soft/40" : "border-border-strong bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-sm font-bold text-ink">{a.name}</span>
                  {a.badgeLabel ? (
                    <span className="rounded bg-violet px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {a.badgeLabel}
                    </span>
                  ) : null}
                  {a.description ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={`About ${a.name}`}
                          className="text-faint hover:text-indigo"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm text-muted-foreground">
                        {a.description}
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
                {a.shortDescription ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.shortDescription}</p>
                ) : null}
                <p className="mt-1 text-sm font-semibold text-ink">
                  {formatCurrency(a.priceCents, { fromCents: true })}
                  <span className="text-muted-foreground">{SUFFIX[a.interval] ?? ""}</span>
                </p>
              </div>

              {stepper ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Remove one ${a.name}`}
                    disabled={qty <= 0}
                    onClick={() => onChange(a.id, Math.max(0, qty - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-5 text-center text-sm font-semibold text-ink">{qty}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Add one ${a.name}`}
                    disabled={qty >= a.maxQuantity}
                    onClick={() => onChange(a.id, Math.min(a.maxQuantity, qty + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange(a.id, active ? 0 : 1)}
                >
                  {active ? "Added" : "Add"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
