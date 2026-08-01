"use client";

import { useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { Button } from "@/components/ui/button";

export function UpgradeButton({
  listingId,
  packageId,
  children,
  className,
}: {
  listingId: string;
  packageId: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const go = () =>
    startTransition(async () => {
      const result = await createCheckoutSession(listingId, packageId);
      if (result.ok) window.location.href = result.url;
      else toast.error(result.error);
    });

  return (
    <Button onClick={go} disabled={pending} className={className}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className="h-4 w-4 fill-white" />
      )}
      {children ?? "Upgrade to Featured"}
    </Button>
  );
}
