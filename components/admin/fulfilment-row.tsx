"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ExternalLink, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils/format";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  markFulfilledAction,
  addFulfilmentNoteAction,
} from "@/lib/admin/fulfilment-actions";
import type { FulfilmentItem } from "@/lib/admin/fulfilment-queries";

export function FulfilmentRow({
  item,
  stripeBase,
}: {
  item: FulfilmentItem;
  stripeBase: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const ageing = item.daysWaiting >= 7;

  function fulfil() {
    startTransition(async () => {
      const res = await markFulfilledAction(item.id, notes);
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function addNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      const res = await addFulfilmentNoteAction(item.id, note);
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        setNote("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <SectionCard className={ageing ? "border-warm-border" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold text-ink">
              {item.quantity > 1 ? `${item.quantity}× ` : ""}
              {item.addonName}
            </span>
            {ageing ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-warm px-2 py-0.5 text-xs font-bold text-warn-ink">
                <AlertTriangle className="h-3 w-3" /> {item.daysWaiting}d waiting
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{item.daysWaiting}d waiting</span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            <Link
              href={`/admin/listings/${item.listingId}`}
              className="font-semibold text-indigo hover:underline"
            >
              {item.listingName}
            </Link>{" "}
            · {item.ownerEmail ?? "—"} · purchased {formatDate(item.createdAt)}
          </div>
        </div>
        <div className="flex gap-2">
          {item.listingSlug ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/listing/${item.listingSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Listing
              </a>
            </Button>
          ) : null}
          {item.stripePaymentIntent ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`${stripeBase}/payments/${item.stripePaymentIntent}`}
                target="_blank"
                rel="noreferrer"
              >
                Refund
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {item.fulfilmentNote ? (
        <p className="mt-3 rounded-xl bg-secondary/50 p-3 text-sm text-ink">
          <b>Instructions:</b> {item.fulfilmentNote}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`done-${item.id}`}>Completion notes (emailed to owner)</Label>
          <Textarea
            id={`done-${item.id}`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Featured in the Friday 3/14 newsletter."
          />
          <Button onClick={fulfil} disabled={pending} className="bg-good text-white hover:bg-good/90">
            <Check className="h-4 w-4" /> Mark fulfilled
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-${item.id}`}>Internal note</Label>
          <Textarea
            id={`note-${item.id}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only staff see this."
          />
          <Button onClick={addNote} disabled={pending} variant="outline">
            <MessageSquarePlus className="h-4 w-4" /> Add note
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
