"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  claimDraftAction,
  type ClaimResult,
} from "@/lib/list-form/finish-actions";
import { SuccessScreen } from "./success-screen";
import { Button } from "@/components/ui/button";

export function ClaimDraft({ draftId }: { draftId: string }) {
  const [result, setResult] = useState<ClaimResult | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    claimDraftAction(draftId).then(setResult);
  }, [draftId]);

  if (!result) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet" />
        <p className="mt-3 text-muted-foreground">Finishing your listing…</p>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold text-ink">
          We couldn&apos;t finish that listing
        </h1>
        <p className="mt-2 text-muted-foreground">{result.error}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to my dashboard</Link>
        </Button>
      </div>
    );
  }

  return <SuccessScreen shareUrl={result.listingUrl} featured={false} />;
}
