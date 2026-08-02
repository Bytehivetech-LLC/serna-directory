"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/format";
import type { FormAddon } from "@/lib/list-form/types";
import {
  ExtrasPicker,
  extrasTotalCents,
  type ExtrasSelection,
} from "@/components/list-form/extras-picker";
import { Button } from "@/components/ui/button";
import { createExtrasCheckoutAction } from "@/lib/stripe/addon-checkout";

export function BuyExtras({
  listingId,
  packageId,
  addons,
}: {
  listingId: string;
  packageId: string | null;
  addons: FormAddon[];
}) {
  const [selected, setSelected] = useState<ExtrasSelection>({});
  const [pending, startTransition] = useTransition();
  const total = extrasTotalCents(addons, selected);

  function buy() {
    const items = addons
      .filter((a) => (selected[a.id] ?? 0) > 0)
      .map((a) => ({ addonId: a.id, quantity: selected[a.id]! }));
    if (!items.length) return;
    startTransition(async () => {
      const res = await createExtrasCheckoutAction({ listingId, addons: items });
      if (res.ok) window.location.href = res.url;
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <ExtrasPicker
        addons={addons}
        packageId={packageId}
        selected={selected}
        onChange={(id, qty) =>
          setSelected((prev) => {
            const next = { ...prev };
            if (qty <= 0) delete next[id];
            else next[id] = qty;
            return next;
          })
        }
      />
      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet/30 bg-violet-soft px-4 py-3">
          <span className="text-sm text-indigo-deep">
            Total{" "}
            <b className="text-ink">{formatCurrency(total, { fromCents: true })}</b>
          </span>
          <Button onClick={buy} disabled={pending}>
            Continue to checkout
          </Button>
        </div>
      ) : null}
    </div>
  );
}
