"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MessageButton({
  targetId = "contact-form",
  className,
}: {
  targetId?: string;
  className?: string;
}) {
  return (
    <Button
      className={className}
      onClick={() =>
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    >
      <MessageSquare className="h-4 w-4" />
      Message
    </Button>
  );
}
