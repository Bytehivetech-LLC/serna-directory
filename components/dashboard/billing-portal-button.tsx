"use client";

import { useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPortalSession } from "@/lib/stripe/actions";
import { Button } from "@/components/ui/button";

export function BillingPortalButton({
  children,
  variant = "outline",
}: {
  children?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const [pending, startTransition] = useTransition();

  const go = () =>
    startTransition(async () => {
      const result = await createPortalSession();
      if (result.ok) window.location.href = result.url;
      else toast.error(result.error);
    });

  return (
    <Button onClick={go} disabled={pending} variant={variant}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="h-4 w-4" />
      )}
      {children ?? "Manage billing"}
    </Button>
  );
}
