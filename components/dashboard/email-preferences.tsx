"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateEmailPrefsAction } from "@/lib/dashboard/email-prefs";

const GROUPS: { id: string; label: string; hint: string; keys: string[] }[] = [
  {
    id: "expiry",
    label: "Expiry & renewal reminders",
    hint: "Nudges before a listing or add-on runs out.",
    keys: ["listing_expiring", "listing_expired", "addon_expiring"],
  },
  {
    id: "tips",
    label: "Welcome & tips",
    hint: "Occasional suggestions for getting more from your listings.",
    keys: ["welcome", "tips"],
  },
];

export function EmailPreferences({ initialOptOut }: { initialOptOut: string[] }) {
  const [optOut, setOptOut] = useState<Set<string>>(new Set(initialOptOut));
  const [pending, startTransition] = useTransition();

  function toggle(keys: string[], on: boolean) {
    const next = new Set(optOut);
    // "on" = receive these = remove keys from opt-out.
    for (const k of keys) {
      if (on) next.delete(k);
      else next.add(k);
    }
    setOptOut(next);
    startTransition(async () => {
      const res = await updateEmailPrefsAction([...next]);
      if (res.ok) toast.success("Preferences saved.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You&apos;ll always get receipts, enquiries, and account-security emails — these control only the optional extras.
      </p>
      {GROUPS.map((g) => {
        const receiving = g.keys.some((k) => !optOut.has(k));
        return (
          <div key={g.id} className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">{g.label}</div>
              <div className="text-xs text-muted-foreground">{g.hint}</div>
            </div>
            <Switch checked={receiving} disabled={pending} onCheckedChange={(on) => toggle(g.keys, on)} aria-label={g.label} />
          </div>
        );
      })}
    </div>
  );
}
