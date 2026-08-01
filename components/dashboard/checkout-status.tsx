"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * After a Checkout redirect, poll the listing (which the webhook updates) every
 * 2s for up to 30s. This only READS is_featured — the webhook is the sole source
 * of truth for paid state.
 */
export function CheckoutStatus({
  listingId,
  state,
  initialFeatured,
}: {
  listingId: string;
  state: "success" | "cancelled";
  initialFeatured: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"confirming" | "done" | "slow">(
    initialFeatured ? "done" : "confirming",
  );

  useEffect(() => {
    if (state !== "success" || initialFeatured) return;
    const supabase = createClient();
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      const { data } = await supabase
        .from("listings")
        .select("is_featured")
        .eq("id", listingId)
        .maybeSingle();
      if (data?.is_featured) {
        setPhase("done");
        clearInterval(timer);
        router.refresh();
      } else if (attempts >= 15) {
        setPhase("slow");
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [state, initialFeatured, listingId, router]);

  if (state === "cancelled") {
    return (
      <Alert>
        <AlertDescription>
          Checkout cancelled — no charge was made. You can upgrade any time.
        </AlertDescription>
      </Alert>
    );
  }

  if (phase === "done") {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-good" />
        <AlertTitle>You&apos;re Featured 🎉</AlertTitle>
        <AlertDescription>
          Your payment cleared and your listing has been upgraded.
        </AlertDescription>
      </Alert>
    );
  }

  if (phase === "slow") {
    return (
      <Alert>
        <AlertDescription>
          This is taking longer than usual — we&apos;ll email you the moment it
          clears.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <Loader2 className="h-4 w-4 animate-spin text-violet" />
      <AlertDescription>Confirming your payment…</AlertDescription>
    </Alert>
  );
}
