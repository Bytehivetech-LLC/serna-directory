"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SuccessScreen({
  shareUrl,
  featured,
}: {
  shareUrl: string;
  featured: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <div className="py-14 text-center">
      <div className="mx-auto mb-5 grid h-[76px] w-[76px] place-items-center rounded-full bg-good-soft text-4xl text-good">
        ✓
      </div>
      <h1 className="font-display text-3xl font-extrabold text-ink">
        You&apos;re live! 🎉
      </h1>
      <p className="mx-auto mt-3.5 max-w-[52ch] text-base text-muted-foreground">
        Your listing page is up and ready to share with families right now.
        It&apos;ll appear in directory search once our team gives it a quick
        look — usually within a couple of days. We&apos;ll email you either way.
      </p>

      <div className="mx-auto mt-6 flex max-w-[460px] gap-2.5">
        <input
          readOnly
          value={shareUrl}
          aria-label="Your listing link"
          className="flex-1 rounded-[10px] border-[1.5px] border-border-strong bg-bg px-3.5 py-2.5 text-[13.5px] text-muted-foreground"
        />
        <Button onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</Button>
      </div>

      {featured ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Next: we&apos;ve emailed you a secure checkout link for your Featured
          listing — it activates the moment payment goes through.
        </p>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">
        Questions?{" "}
        <a
          href="mailto:Info@SernaEducationalServices.com"
          className="font-semibold text-indigo"
        >
          Info@SernaEducationalServices.com
        </a>
      </p>
    </div>
  );
}
