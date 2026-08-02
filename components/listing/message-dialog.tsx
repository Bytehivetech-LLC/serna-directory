"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactForm } from "./contact-form";

/** "Message" button that opens the contact form in a popup. */
export function MessageDialog({
  listingId,
  businessName,
  className,
}: {
  listingId: string;
  businessName: string;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={className}>
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Contact {businessName}
          </DialogTitle>
          <DialogDescription>
            Send a message and they&apos;ll reply straight to your email.
          </DialogDescription>
        </DialogHeader>
        <ContactForm listingId={listingId} businessName={businessName} />
      </DialogContent>
    </Dialog>
  );
}
