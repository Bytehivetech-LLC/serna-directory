"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A right-side slide-out panel with NO overlay and NO scroll lock. It's
 * non-modal, and outside interaction doesn't dismiss it — so you can change
 * filters here and watch the results update live behind it. Close via the X or
 * Escape.
 */
export function FilterDrawer({
  trigger,
  title,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root modal={false}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-sm flex-col border-l border-border bg-card shadow-card outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="font-display text-lg font-bold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close filters"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Refine listings by subject, format, and more.
          </Dialog.Description>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
