"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, EyeOff, MoreHorizontal, Pencil, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  duplicateListingAction,
  softDeleteListingAction,
  unpublishListingAction,
} from "@/lib/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ListingRowActions({
  listingId,
  slug,
  businessName,
  status,
}: {
  listingId: string;
  slug: string;
  businessName: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; id?: string; error?: string }>, ok?: (id?: string) => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) ok?.(result.id);
      else toast.error(result.error ?? "Something went wrong.");
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Listing actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/listings/${listingId}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/listing/${slug}`} target="_blank">
              <SquareArrowOutUpRight className="h-4 w-4" /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              run(() => duplicateListingAction(listingId), (id) => {
                toast.success("Listing duplicated");
                if (id) router.push(`/dashboard/listings/${id}/edit`);
              });
            }}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          {status === "published" ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                run(() => unpublishListingAction(listingId), () => {
                  toast.success("Listing unpublished");
                  router.refresh();
                });
              }}
            >
              <EyeOff className="h-4 w-4" /> Unpublish
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmText("");
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Delete this listing?</DialogTitle>
            <DialogDescription>
              This removes <b className="text-ink">{businessName}</b> from your
              account and the directory. To confirm, type the business name below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete">Business name</Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={businessName}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText.trim() !== businessName || pending}
              onClick={() =>
                run(() => softDeleteListingAction(listingId), () => {
                  toast.success("Listing deleted");
                  setDeleteOpen(false);
                  router.refresh();
                })
              }
            >
              Delete listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
