"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, PencilLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveListingAction,
  rejectListingAction,
  requestChangesListingAction,
} from "@/lib/admin/listing-actions";
import type { AdminActionResult } from "@/lib/admin/users-actions";

type ReasonMode = "reject" | "changes" | null;

export function ReviewActionBar({
  listingId,
  businessName,
  skipIds,
  remaining,
}: {
  listingId: string;
  businessName: string;
  skipIds: string[];
  remaining: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasonMode, setReasonMode] = useState<ReasonMode>(null);
  const [reason, setReason] = useState("");

  const goNext = useCallback(() => {
    // Re-fetch the queue (approved/rejected items drop out on their own).
    router.refresh();
  }, [router]);

  const skip = useCallback(() => {
    const next = [...skipIds, listingId];
    router.push(`/admin/listings/review?skip=${next.join(",")}`);
  }, [router, skipIds, listingId]);

  const run = useCallback(
    (fn: () => Promise<AdminActionResult>) => {
      startTransition(async () => {
        const res = await fn();
        if (res.ok) {
          toast.success(res.message ?? "Done.");
          setReasonMode(null);
          setReason("");
          goNext();
        } else {
          toast.error(res.error);
        }
      });
    },
    [goNext],
  );

  const approve = useCallback(
    () => run(() => approveListingAction(listingId)),
    [run, listingId],
  );

  // Keyboard shortcuts: A approve · R reject · S skip. Ignore while typing or
  // when the reason dialog is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (reasonMode) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        approve();
      } else if (k === "r") {
        e.preventDefault();
        setReason("");
        setReasonMode("reject");
      } else if (k === "s") {
        e.preventDefault();
        skip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reasonMode, approve, skip]);

  return (
    <>
      <div className="sticky bottom-0 z-20 -mx-5 border-t border-border bg-card/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted-foreground">
            <b className="text-ink">{remaining}</b> in queue
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              onClick={approve}
              disabled={pending}
              className="bg-good text-white hover:bg-good/90"
            >
              <Check className="h-4 w-4" /> Approve <Kbd>A</Kbd>
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setReason("");
                setReasonMode("changes");
              }}
            >
              <PencilLine className="h-4 w-4" /> Request changes
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              className="border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => {
                setReason("");
                setReasonMode("reject");
              }}
            >
              <X className="h-4 w-4" /> Reject <Kbd>R</Kbd>
            </Button>
            <Button variant="ghost" disabled={pending} onClick={skip}>
              Skip <Kbd>S</Kbd> <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={reasonMode !== null} onOpenChange={(o) => !o && setReasonMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {reasonMode === "reject" ? "Reject" : "Request changes to"} {businessName}
            </DialogTitle>
            <DialogDescription>
              {reasonMode === "reject"
                ? "This emails the owner your reason and marks the listing rejected."
                : "This emails the owner your notes and moves the listing back to draft so they can edit and resubmit."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="review-reason">
              {reasonMode === "reject" ? "Reason for rejection" : "What needs to change"}
            </Label>
            <Textarea
              id="review-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              autoFocus
              placeholder={
                reasonMode === "reject"
                  ? "e.g. This looks like a duplicate of an existing listing."
                  : "e.g. Please add a description and at least one photo."
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonMode(null)}>
              Cancel
            </Button>
            <Button
              variant={reasonMode === "reject" ? "destructive" : "default"}
              disabled={pending || reason.trim().length < 5}
              onClick={() =>
                run(() =>
                  reasonMode === "reject"
                    ? rejectListingAction(listingId, reason)
                    : requestChangesListingAction(listingId, reason),
                )
              }
            >
              {reasonMode === "reject" ? "Reject listing" : "Send back for changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 hidden rounded border border-current/30 px-1 text-[10px] font-bold opacity-70 sm:inline">
      {children}
    </kbd>
  );
}
